import type { Request, Response } from 'express'
import { basename, join, isAbsolute, relative, resolve } from 'path'
import { prisma } from '../../db/client.js'
import { ValidationOrchestrator } from '../../services/ValidationOrchestrator.js'
import { GATES_CONFIG } from '../../config/gates.config.js'
import type { CreateRunInput } from '../schemas/validation.schema.js'

const orchestrator = new ValidationOrchestrator()
const allowedTestExtensions = new Set([
  '.spec.ts',
  '.spec.tsx',
  '.test.ts',
  '.test.tsx',
  '.spec.js',
  '.spec.jsx',
  '.test.js',
  '.test.jsx',
])

const sanitizeOutputId = (outputId: string): string => {
  return outputId.replace(/\.\./g, '').replace(/[\\/ ]/g, '')
}

export class ValidationController {
  async createRun(req: Request, res: Response): Promise<void> {
    try {
      console.log('[createRun] Started with body:', JSON.stringify(req.body, null, 2))
      const data = req.body as CreateRunInput
      const sanitizedOutputId = sanitizeOutputId(data.outputId)
      console.log('[createRun] Sanitized outputId:', sanitizedOutputId)

      if (sanitizedOutputId !== data.outputId || sanitizedOutputId.length === 0) {
        res.status(400).json({ error: 'Invalid outputId' })
        return
      }

      // projectId is now REQUIRED
      if (!data.projectId) {
        res.status(400).json({
          error: 'projectId is required',
          message: 'You must select a project when creating a validation run. Configure projects at /config.',
        })
        return
      }

      console.log('[createRun] Using project-based configuration with projectId:', data.projectId)
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        include: { workspace: true },
      })

      if (!project) {
        res.status(400).json({ error: 'Project not found' })
        return
      }

      if (!project.isActive) {
        res.status(400).json({ error: 'Project is not active' })
        return
      }

      const projectRoot = project.workspace.rootPath
      const artifactsDir = project.workspace.artifactsDir
      const baseRef = project.baseRef
      const targetRef = project.targetRef
      const backendWorkspace = project.backendWorkspace || undefined
      const projectPath = projectRoot
      const resolvedProjectId = data.projectId

      console.log('[createRun] Project settings:', {
        projectRoot,
        artifactsDir,
        baseRef,
        targetRef,
        backendWorkspace,
        projectPath,
      })

      const manifestTestFile = data.manifest.testFile?.trim()
      if (!manifestTestFile) {
        res.status(400).json({ error: 'Invalid test file name in manifest' })
        return
      }
      if (isAbsolute(manifestTestFile)) {
        res.status(400).json({
          error: 'Invalid manifest.testFile',
          message: 'manifest.testFile must be a relative path inside the project root.',
        })
        return
      }

      const resolvedTestPath = resolve(projectPath, manifestTestFile)
      const relativeToProject = relative(projectPath, resolvedTestPath)
      if (relativeToProject.startsWith('..') || isAbsolute(relativeToProject)) {
        res.status(400).json({
          error: 'Invalid manifest.testFile',
          message: 'manifest.testFile must not escape the project root.',
        })
        return
      }

      const lowerFileName = basename(manifestTestFile).toLowerCase()
      const hasAllowedExtension = Array.from(allowedTestExtensions).some((ext) =>
        lowerFileName.endsWith(ext),
      )
      if (!hasAllowedExtension) {
        res.status(400).json({ error: 'Invalid testFile extension' })
        return
      }

      const canonicalTestPath = join(projectPath, manifestTestFile)
      const normalizedCanonicalTestPath = canonicalTestPath.replace(/\\/g, '/')
      console.log('[createRun] Canonical spec path:', normalizedCanonicalTestPath)

      // Validação para runs que referenciam um contract run
      console.log('[createRun] Checking contract run validation...')
      if (data.contractRunId) {
        const contractRun = await prisma.validationRun.findUnique({
          where: { id: data.contractRunId },
        })

        if (!contractRun) {
          res.status(400).json({ error: 'Contract run not found' })
          return
        }

        if (contractRun.runType !== 'CONTRACT') {
          res.status(400).json({ error: 'Referenced run is not a CONTRACT run' })
          return
        }

        if (contractRun.status !== 'PASSED') {
          res.status(400).json({ error: 'Contract run must have PASSED status' })
          return
        }
      }

      console.log('[createRun] Creating run in database...')
      const run = await prisma.validationRun.create({
        data: {
          projectId: resolvedProjectId,
          outputId: data.outputId,
          projectPath: projectPath,
          taskPrompt: data.taskPrompt,
          manifestJson: JSON.stringify(data.manifest),
          testFilePath: normalizedCanonicalTestPath,
          baseRef: baseRef,
          targetRef: targetRef,
          dangerMode: data.dangerMode,
          status: 'PENDING',
          runType: data.runType,
          contractRunId: data.contractRunId,
          contractJson: data.contract ? JSON.stringify(data.contract) : null,
        },
      })

      console.log('[createRun] Run created:', run.id)

      // For runs with contractRunId, queue automatically (spec will be copied by orchestrator)
      if (data.contractRunId) {
        console.log('[createRun] Queueing run automatically...')
        orchestrator.addToQueue(run.id).catch((error) => {
          console.error(`[createRun] Error queueing run ${run.id}:`, error)
        })
      } else {
        // Run is in PENDING state, waiting for file upload to start execution
        console.log('[createRun] Run is in PENDING state, waiting for file upload to start execution...')
      }

      console.log('[createRun] Sending response...')
      res.status(201).json({
        runId: run.id,
        outputId: run.outputId,
        status: run.status,
        createdAt: run.createdAt,
      })
    } catch (error) {
      console.error('[createRun] ERROR:', error)
      res.status(500).json({
        error: 'Failed to create validation run',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async listGates(req: Request, res: Response): Promise<void> {
    const gates = GATES_CONFIG.map((gate) => ({
      number: gate.number,
      name: gate.name,
      emoji: gate.emoji,
      description: gate.description,
      validatorCount: gate.validators.length,
    }))

    res.json(gates)
  }

  async getGateValidators(req: Request, res: Response): Promise<void> {
    const gateNumber = parseInt(req.params.number)
    const gate = GATES_CONFIG.find((g) => g.number === gateNumber)

    if (!gate) {
      res.status(404).json({ error: 'Gate not found' })
      return
    }

    const validators = gate.validators.map((v) => ({
      code: v.code,
      name: v.name,
      description: v.description,
      order: v.order,
      isHardBlock: v.isHardBlock,
    }))

    res.json(validators)
  }

  async getConfig(req: Request, res: Response): Promise<void> {
    const config = await prisma.validationConfig.findMany()
    res.json(config)
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    const { key } = req.params
    const { value } = req.body

    const updated = await prisma.validationConfig.update({
      where: { key },
      data: { value: String(value) },
    })

    res.json(updated)
  }
}



