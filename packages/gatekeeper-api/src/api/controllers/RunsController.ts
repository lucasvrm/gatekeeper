import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { RunEventService } from '../../services/RunEventService.js'
import { ArtifactsService } from '../../services/ArtifactsService.js'

export class RunsController {
  async listArtifacts(req: Request, res: Response): Promise<void> {
    const { projectId } = req.query

    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' })
      return
    }

    const project = await prisma.project.findUnique({
      where: { id: String(projectId) },
      include: { workspace: true },
    })

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const artifactsBasePath = path.join(project.workspace.rootPath, project.workspace.artifactsDir)
    const artifactsService = new ArtifactsService()

    try {
      const folders = await artifactsService.listFolders(artifactsBasePath)
      const sorted = folders.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      res.status(200).json(sorted)
    } catch (error) {
      console.error('[listArtifacts] Failed to list artifact folders:', error)
      res.status(200).json([])
    }
  }

  async getArtifactContents(req: Request, res: Response): Promise<void> {
    const { outputId } = req.params
    const { projectId } = req.query

    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' })
      return
    }

    const project = await prisma.project.findUnique({
      where: { id: String(projectId) },
      include: { workspace: true },
    })

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const artifactsBasePath = path.join(project.workspace.rootPath, project.workspace.artifactsDir)
    const artifactsService = new ArtifactsService()
    const status = await artifactsService.validateFolder(artifactsBasePath, outputId)

    if (!status.exists) {
      res.status(404).json({ error: 'Artifact folder not found' })
      return
    }

    const contents = await artifactsService.readContents(artifactsBasePath, outputId)
    res.status(200).json(contents)
  }
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
        include: {
          project: {
            select: {
              id: true,
              name: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
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
        executionRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
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

    if (run.commitHash) {
      res.status(409).json({
        error: { code: 'RUN_COMMITTED', message: 'Run já commitada. Nenhuma alteração permitida.' }
      })
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

    // Reset run to initial state (preserving bypassed validators)
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
        // NOTE: bypassedValidators are preserved so user doesn't lose their bypasses on rerun
      },
    })

    // Import and queue the run for execution
    // Note: spec path verification is handled by ValidationOrchestrator.ensureSpecAtCorrectPath
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

    if (run.commitHash) {
      res.status(409).json({
        error: { code: 'RUN_COMMITTED', message: 'Run já commitada. Nenhuma alteração permitida.' }
      })
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

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    if (run.commitHash) {
      res.status(409).json({
        error: { code: 'RUN_COMMITTED', message: 'Run já commitada. Nenhuma alteração permitida.' }
      })
      return
    }

    try {
      // Use the projectPath from the run (already set during run creation)
      const projectRoot = run.projectPath
      console.log('[uploadFiles] Using projectRoot from run:', projectRoot)

      if (!projectRoot) {
        res.status(500).json({ error: 'Run does not have a valid projectPath' })
        return
      }

      const artifactsDir = await this.resolveArtifactsDir(run)
      console.log('[uploadFiles] Using artifactsDir:', artifactsDir)

      // Resolver paths
      const artifactsBasePath = path.join(projectRoot, artifactsDir)
      const artifactDir = path.join(artifactsBasePath, run.outputId)

      await fs.mkdir(artifactDir, { recursive: true })
      const uploadedFiles: { type: string; path: string; size: number }[] = []

      const hasUploadedFiles = files && Object.keys(files).length > 0

      if (!hasUploadedFiles) {
        const filesystemArtifactDir = path.join(artifactsBasePath, run.outputId)
        const contents = await fs.readdir(filesystemArtifactDir).catch((): string[] => [])
        const specFileName = contents.find((file) => file.endsWith('.spec.tsx') || file.endsWith('.spec.ts')) || null

        if (!specFileName) {
          res.status(400).json({ error: 'Spec file not found in artifacts folder' })
          return
        }

        const planPath = path.join(filesystemArtifactDir, 'plan.json')
        const planExists = contents.includes('plan.json')

        if (planExists) {
          try {
            const planRaw = await fs.readFile(planPath, 'utf-8')
            const planData = JSON.parse(planRaw)
            uploadedFiles.push({ type: 'plan.json', path: planPath, size: Buffer.byteLength(planRaw) })
            if (planData.contract) {
              await prisma.validationRun.update({
                where: { id },
                data: { contractJson: JSON.stringify(planData.contract) },
              })
            }
          } catch (error) {
            console.error('[uploadFiles] Failed to parse plan.json from artifacts:', error)
          }
        }

        // Spec stays in artifacts/, will be copied to correct path by orchestrator
        const artifactsSpecPath = path.join(filesystemArtifactDir, specFileName)
        uploadedFiles.push({
          type: 'spec',
          path: artifactsSpecPath,
          size: (await fs.stat(artifactsSpecPath)).size,
        })
      }

      // Process plan.json
      if (hasUploadedFiles && files && files['planJson'] && files['planJson'][0]) {
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

        // Extract contract from plan.json and update run
        try {
          const planData = JSON.parse(planFile.buffer.toString('utf-8'))
          if (planData.contract) {
            await prisma.validationRun.update({
              where: { id },
              data: {
                contractJson: JSON.stringify(planData.contract),
              },
            })
          }
        } catch (error) {
          console.error('Failed to extract contract from plan.json:', error)
        }
      }

      // Process spec file
      if (hasUploadedFiles && files && files['specFile'] && files['specFile'][0]) {
        const specFile = files['specFile'][0]

        // Validate file size (max 5MB)
        if (specFile.size > 5 * 1024 * 1024) {
          res.status(400).json({ error: 'Spec file exceeds maximum size of 5MB' })
          return
        }

        // Get the spec filename from manifest (not from originalname which is generic "generated.spec.ts")
        let specFileName: string
        let specBaseName: string

        // Parse manifest to get the correct testFile name
        if (run.manifestJson) {
          try {
            const manifest = JSON.parse(run.manifestJson) as { testFile?: string }
            if (manifest.testFile) {
              specFileName = manifest.testFile
              specBaseName = path.basename(manifest.testFile)
            } else {
              // Fallback to originalname
              specFileName = specFile.originalname
              specBaseName = path.basename(specFileName)
            }
          } catch (error) {
            console.warn('[uploadFiles] Failed to parse manifest, using originalname')
            specFileName = specFile.originalname
            specBaseName = path.basename(specFileName)
          }
        } else {
          // No manifest, use originalname
          specFileName = specFile.originalname
          specBaseName = path.basename(specFileName)
        }

        const hasTestExt = specBaseName.endsWith('.spec.tsx') || specBaseName.endsWith('.spec.ts') ||
          specBaseName.endsWith('.test.tsx') || specBaseName.endsWith('.test.ts')
        if (!hasTestExt) {
          res.status(400).json({ error: 'Spec file must have .spec.tsx/.spec.ts/.test.tsx/.test.ts extension' })
          return
        }

        console.log('[uploadFiles] Using spec filename from manifest:', specFileName)

        // Save to artifacts/ - will be copied to correct path by orchestrator
        // If filename has path separators (e.g. "src/__tests__/spec.tsx"), create parent dirs
        const artifactsSpecPath = path.join(artifactDir, specFileName)
        const specDir = path.dirname(artifactsSpecPath)
        if (specDir !== artifactDir) {
          await fs.mkdir(specDir, { recursive: true })
        }
        await fs.writeFile(artifactsSpecPath, specFile.buffer)
        console.log('[uploadFiles] Saved spec to artifacts:', artifactsSpecPath)

        // Also save a flat copy at root of outputId dir for ensureSpecAtCorrectPath
        // which looks for basename(manifest.testFile) at the root level
        if (specBaseName !== specFileName) {
          const flatPath = path.join(artifactDir, specBaseName)
          await fs.writeFile(flatPath, specFile.buffer)
          console.log('[uploadFiles] Also saved flat copy:', flatPath)
        }

        uploadedFiles.push({ type: 'spec', path: artifactsSpecPath, size: specFile.size })
      }

      // Reset and queue the run based on its current status
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
      }

      // Always queue the run for execution after file upload (initial or re-execution)
      if (run.status === 'PENDING' || run.status === 'PASSED' || run.status === 'FAILED' || run.status === 'ABORTED') {
        const { ValidationOrchestrator } = await import('../../services/ValidationOrchestrator.js')
        const orchestrator = new ValidationOrchestrator()
        orchestrator.addToQueue(id).catch((error) => {
          console.error(`Error executing run ${id} after file upload:`, error)
        })
      }

      const shouldQueue = run.status === 'PENDING' || run.status === 'PASSED' || run.status === 'FAILED' || run.status === 'ABORTED'
      const wasReset = run.status === 'PASSED' || run.status === 'FAILED' || run.status === 'ABORTED'

      res.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles,
        runReset: wasReset,
        runQueued: shouldQueue
      })
    } catch (error) {
      console.error('Error uploading files:', error)
      res.status(500).json({
        error: 'Failed to upload files',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async resolveArtifactsDir(
    run: { testFilePath: string; projectId: string | null },
  ): Promise<string> {
    if (run.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: run.projectId },
        include: { workspace: true },
      })
      if (project) {
        return project.workspace.artifactsDir
      }
    }

    return 'artifacts'
  }
}
