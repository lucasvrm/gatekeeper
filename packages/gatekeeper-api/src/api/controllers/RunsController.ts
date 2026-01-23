import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { RunEventService } from '../../services/RunEventService.js'
import { PathResolverService } from '../../services/PathResolverService.js'
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

    // Reset run to initial state (including clearing bypassed validators)
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
        bypassedValidators: null,
      },
    })

    // Verify that spec file is in correct path, restore from artifacts if needed
    console.log('[rerunGate] Verifying spec file path...')
    if (run.testFilePath && run.manifestJson && run.projectPath) {
      try {
        const pathResolver = new PathResolverService()
        const artifactsDir = await this.resolveArtifactsDir(run)
        const artifactsPath = path.join(
          run.projectPath,
          artifactsDir,
          run.outputId,
          path.basename(run.testFilePath),
        )
        const correctPath = await pathResolver.recheckAndCopy(run.testFilePath, artifactsPath)

        // Update if path changed
        if (correctPath !== run.testFilePath) {
          await prisma.validationRun.update({
            where: { id },
            data: { testFilePath: correctPath },
          })
          console.log('[rerunGate] ✅ Spec file path updated:', correctPath)
        } else {
          console.log('[rerunGate] ✅ Spec file already in correct path')
        }
      } catch (error) {
        console.error('[rerunGate] ⚠️ Failed to verify/restore spec file, continuing anyway:', error)
      }
    }

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

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
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
      const runTestFilePath = run.testFilePath
      let artifactDir: string

      if (runTestFilePath && path.isAbsolute(runTestFilePath)) {
        artifactDir = path.dirname(runTestFilePath)
      } else {
        artifactDir = path.join(artifactsBasePath, run.outputId)
      }

      await fs.mkdir(artifactDir, { recursive: true })
      const uploadedFiles: { type: string; path: string; size: number }[] = []

      const hasUploadedFiles = files && Object.keys(files).length > 0

      if (!hasUploadedFiles) {
        const filesystemArtifactDir = path.join(artifactsBasePath, run.outputId)
        const contents = await fs.readdir(filesystemArtifactDir).catch(() => [])
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

        const artifactsSpecPath = path.join(filesystemArtifactDir, specFileName)
        const targetSpecPath = await this.resolveAndPersistSpecPath(
          run,
          projectRoot,
          artifactsSpecPath,
          specFileName,
        )

        uploadedFiles.push({
          type: 'spec',
          path: targetSpecPath,
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

        // Extract original filename to get the proper spec filename
        const specFileName = specFile.originalname
        if (!specFileName.endsWith('.spec.tsx') && !specFileName.endsWith('.spec.ts')) {
          res.status(400).json({ error: 'Spec file must have .spec.tsx or .spec.ts extension' })
          return
        }

        // Step 1: Save to artifacts/ first
        const artifactsSpecPath = path.join(artifactDir, specFileName)
        await fs.writeFile(artifactsSpecPath, specFile.buffer)
        console.log('[uploadFiles] Saved spec to artifacts:', artifactsSpecPath)

        // Step 2: Use PathResolverService to copy to correct path
        const targetSpecPath = await this.resolveAndPersistSpecPath(
          run,
          projectRoot,
          artifactsSpecPath,
          specFileName,
        )

        uploadedFiles.push({ type: 'spec', path: targetSpecPath, size: specFile.size })
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
    const testFilePath = run.testFilePath || ''
    if (testFilePath.includes('/artifacts/') || testFilePath.includes('\\artifacts\\')) {
      return 'artifacts'
    }

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

  private async resolveAndPersistSpecPath(
    run: { id: string; manifestJson: string | null; outputId: string },
    projectRoot: string,
    artifactsSpecPath: string,
    specFileName: string
  ): Promise<string> {
    const pathResolver = new PathResolverService()
    let targetSpecPath: string
    let shouldCopyFallback = false

    if (run.manifestJson) {
      try {
        const manifest = JSON.parse(run.manifestJson)
        targetSpecPath = await pathResolver.ensureCorrectPath(
          artifactsSpecPath,
          manifest,
          projectRoot,
          run.outputId
        )
        console.log('[uploadFiles] ✅ Spec copied to correct path:', targetSpecPath)
      } catch (error) {
        console.error('[uploadFiles] Failed to resolve spec path, using fallback:', error)
        targetSpecPath = path.join(projectRoot, 'src', specFileName)
        shouldCopyFallback = true
      }
    } else {
      targetSpecPath = path.join(projectRoot, 'src', specFileName)
      shouldCopyFallback = true
    }

    const normalizedTarget = targetSpecPath.replace(/\\/g, '/')
    if (shouldCopyFallback || !normalizedTarget.includes('/src/')) {
      const fallbackPath = path.join(projectRoot, 'src', specFileName)
      try {
        await fs.mkdir(path.dirname(fallbackPath), { recursive: true })
        if (await fs.stat(artifactsSpecPath).then(() => true).catch(() => false)) {
          await fs.copyFile(artifactsSpecPath, fallbackPath)
        }
      } catch (error) {
        console.error('[uploadFiles] Failed to copy spec to fallback /src path:', error)
      }
      targetSpecPath = fallbackPath
    }

    const normalizedPath = targetSpecPath.replace(/\\/g, '/')

    await prisma.validationRun.update({
      where: { id: run.id },
      data: { testFilePath: normalizedPath },
    })

    return normalizedPath
  }
}
