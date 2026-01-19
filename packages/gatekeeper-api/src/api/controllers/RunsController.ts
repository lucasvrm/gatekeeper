import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { RunEventService } from '../../services/RunEventService.js'

const ARTIFACTS_BASE_PATH_KEY = 'ARTIFACTS_BASE_PATH'

const normalizeConfigValue = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed === '' || trimmed === '.' ? null : trimmed
}

const resolveArtifactsBasePath = (artifactsBasePath: string | null, projectPath: string): string => {
  if (!artifactsBasePath) {
    return path.join(projectPath, 'artifacts')
  }
  return path.isAbsolute(artifactsBasePath)
    ? artifactsBasePath
    : path.resolve(projectPath, artifactsBasePath)
}

export class RunsController {
  async getRun(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    res.json(run)
  }

  async listRuns(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, status } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where = status ? { status: String(status) } : undefined

    const [runs, total] = await Promise.all([
      prisma.validationRun.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.validationRun.count({ where }),
    ])

    res.json({
      data: runs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  }

  async getRunResults(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const run = await prisma.validationRun.findUnique({
      where: { id },
      include: {
        gateResults: {
          orderBy: { gateNumber: 'asc' },
        },
        validatorResults: {
          orderBy: [{ gateNumber: 'asc' }, { validatorOrder: 'asc' }],
        },
      },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    res.json(run)
  }

  async abortRun(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    if (run.status !== 'PENDING' && run.status !== 'RUNNING') {
      res.status(400).json({
        error: 'Cannot abort run',
        message: `Run is already ${run.status}`,
      })
      return
    }

    const updated = await prisma.validationRun.update({
      where: { id },
      data: {
        status: 'ABORTED',
        completedAt: new Date(),
      },
    })

    res.json(updated)
  }

  async deleteRun(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    await prisma.validationRun.delete({
      where: { id },
    })

    res.status(204).send()
  }

  async rerunGate(req: Request, res: Response): Promise<void> {
    const { id, gateNumber } = req.params
    const gate = parseInt(gateNumber)

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    if (run.status === 'PENDING' || run.status === 'RUNNING') {
      res.status(400).json({
        error: 'Cannot rerun gate',
        message: 'Run is currently in progress',
      })
      return
    }

    // Validate gate number is valid for run type
    const validGates = run.runType === 'EXECUTION' ? [2, 3] : [0, 1]
    if (!validGates.includes(gate)) {
      res.status(400).json({
        error: 'Invalid gate number',
        message: `Gate ${gate} is not valid for ${run.runType} runs`,
      })
      return
    }

    // For simplicity, we'll rerun the entire run
    // Delete all gate and validator results
    await prisma.validatorResult.deleteMany({
      where: { runId: id },
    })

    await prisma.gateResult.deleteMany({
      where: { runId: id },
    })

    // Reset run to initial state
    const firstGate = run.runType === 'EXECUTION' ? 2 : 0
    await prisma.validationRun.update({
      where: { id },
      data: {
        status: 'PENDING',
        currentGate: firstGate,
        passed: false,
        failedAt: null,
        failedValidatorCode: null,
        startedAt: null,
        completedAt: null,
      },
    })

    // Import and queue the run for execution
    const { ValidationOrchestrator } = await import('../../services/ValidationOrchestrator.js')
    const orchestrator = new ValidationOrchestrator()
    orchestrator.addToQueue(id).catch((error) => {
      console.error(`Error re-executing run ${id}:`, error)
    })

    res.json({ message: 'Run queued for re-execution', runId: id })
  }

  async bypassValidator(req: Request, res: Response): Promise<void> {
    const { id, validatorCode } = req.params

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    if (run.status !== 'FAILED') {
      res.status(400).json({
        error: 'Cannot bypass validator',
        message: 'Run must be failed to bypass a validator',
      })
      return
    }

    const validatorResult = await prisma.validatorResult.findUnique({
      where: {
        runId_validatorCode: {
          runId: id,
          validatorCode,
        },
      },
    })

    if (!validatorResult) {
      res.status(404).json({ error: 'Validator result not found' })
      return
    }

    if (!validatorResult.isHardBlock) {
      res.status(400).json({
        error: 'Cannot bypass validator',
        message: 'Only hard block validators can be bypassed this way',
      })
      return
    }

    if (validatorResult.status !== 'FAILED') {
      res.status(400).json({
        error: 'Cannot bypass validator',
        message: 'Validator must be in failed state to bypass',
      })
      return
    }

    if (validatorResult.bypassed) {
      res.status(400).json({
        error: 'Validator already bypassed',
      })
      return
    }

    let bypassedList: string[] = []
    if (run.bypassedValidators) {
      try {
        const parsed = JSON.parse(run.bypassedValidators)
        if (Array.isArray(parsed)) {
          bypassedList = parsed.filter((item) => typeof item === 'string')
        }
      } catch (error) {
        console.error('Failed to parse bypassed validators JSON:', error)
      }
    }

    if (bypassedList.includes(validatorCode)) {
      res.status(400).json({
        error: 'Validator already bypassed',
      })
      return
    }

    const updatedBypassList = Array.from(new Set([...bypassedList, validatorCode]))
    const firstGate = run.runType === 'EXECUTION' ? 2 : 0

    await prisma.validatorResult.deleteMany({
      where: { runId: id },
    })

    await prisma.gateResult.deleteMany({
      where: { runId: id },
    })

    await prisma.validationRun.update({
      where: { id },
      data: {
        status: 'PENDING',
        currentGate: firstGate,
        passed: false,
        failedAt: null,
        failedValidatorCode: null,
        startedAt: null,
        completedAt: null,
        summary: null,
        bypassedValidators: JSON.stringify(updatedBypassList),
      },
    })

    RunEventService.emitRunStatus(id, 'PENDING')

    const { ValidationOrchestrator } = await import('../../services/ValidationOrchestrator.js')
    const orchestrator = new ValidationOrchestrator()
    orchestrator.addToQueue(id).catch((error) => {
      console.error(`Error executing run ${id} after bypassing validator:`, error)
    })

    res.json({
      message: 'Validator bypassed and run queued for re-execution',
      runId: id,
    })
  }

  async uploadFiles(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    if (!files || Object.keys(files).length === 0) {
      res.status(400).json({ error: 'No files provided' })
      return
    }

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    try {
      const artifactsConfig = await prisma.validationConfig.findUnique({
        where: { key: ARTIFACTS_BASE_PATH_KEY },
      })
      const normalizedArtifactsBase = normalizeConfigValue(artifactsConfig?.value)
      const fallbackArtifactsBase = resolveArtifactsBasePath(
        normalizedArtifactsBase,
        run.projectPath,
      )
      const runTestFilePath = run.testFilePath
      let artifactDir: string
      let resolvedSpecPath: string | null = null

      if (runTestFilePath && path.isAbsolute(runTestFilePath)) {
        resolvedSpecPath = runTestFilePath
        artifactDir = path.dirname(resolvedSpecPath)
      } else {
        artifactDir = path.join(fallbackArtifactsBase, run.outputId)
      }

      await fs.mkdir(artifactDir, { recursive: true })
      const uploadedFiles: { type: string; path: string; size: number }[] = []

      // Process plan.json
      if (files['planJson'] && files['planJson'][0]) {
        const planFile = files['planJson'][0]

        // Validate file size (max 5MB)
        if (planFile.size > 5 * 1024 * 1024) {
          res.status(400).json({ error: 'plan.json exceeds maximum size of 5MB' })
          return
        }

        try {
          JSON.parse(planFile.buffer.toString('utf-8'))
        } catch {
          res.status(400).json({ error: 'plan.json is not valid JSON' })
          return
        }

        const planPath = path.join(artifactDir, 'plan.json')
        await fs.writeFile(planPath, planFile.buffer)
        uploadedFiles.push({ type: 'plan.json', path: planPath, size: planFile.size })
      }

      // Process spec file
      if (files['specFile'] && files['specFile'][0]) {
        const specFile = files['specFile'][0]

        // Validate file size (max 5MB)
        if (specFile.size > 5 * 1024 * 1024) {
          res.status(400).json({ error: 'Spec file exceeds maximum size of 5MB' })
          return
        }

        // Extract original filename to get the proper spec filename
        const specFileName = specFile.originalname
        if (!specFileName.endsWith('.spec.tsx') && !specFileName.endsWith('.spec.ts')) {
          res.status(400).json({ error: 'Spec file must have .spec.tsx or .spec.ts extension' })
          return
        }

        const targetSpecPath =
          resolvedSpecPath && path.basename(resolvedSpecPath) === specFileName
            ? resolvedSpecPath
            : path.join(artifactDir, specFileName)
        await fs.writeFile(targetSpecPath, specFile.buffer)
        uploadedFiles.push({ type: 'spec', path: targetSpecPath, size: specFile.size })
      }

      // Reset the run if it was completed/failed
      if (run.status === 'PASSED' || run.status === 'FAILED' || run.status === 'ABORTED') {
        // Delete all gate and validator results
        await prisma.validatorResult.deleteMany({
          where: { runId: id },
        })

        await prisma.gateResult.deleteMany({
          where: { runId: id },
        })

        // Reset run to initial state
        const firstGate = run.runType === 'EXECUTION' ? 2 : 0
        await prisma.validationRun.update({
          where: { id },
          data: {
            status: 'PENDING',
            currentGate: firstGate,
            passed: false,
            failedAt: null,
            failedValidatorCode: null,
            startedAt: null,
            completedAt: null,
          },
        })

        // Queue the run for re-execution
        const { ValidationOrchestrator } = await import('../../services/ValidationOrchestrator.js')
        const orchestrator = new ValidationOrchestrator()
        orchestrator.addToQueue(id).catch((error) => {
          console.error(`Error re-executing run ${id} after file upload:`, error)
        })
      }

      res.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles,
        runReset: run.status === 'PASSED' || run.status === 'FAILED' || run.status === 'ABORTED'
      })
    } catch (error) {
      console.error('Error uploading files:', error)
      res.status(500).json({
        error: 'Failed to upload files',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
