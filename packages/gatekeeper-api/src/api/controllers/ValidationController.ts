import type { Request, Response } from 'express'
import { basename, join } from 'path'
import { promises as fs } from 'node:fs'
import { prisma } from '../../db/client.js'
import { ValidationOrchestrator } from '../../services/ValidationOrchestrator.js'
import { PathResolverService } from '../../services/PathResolverService.js'
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

const sanitizeTestFileName = (value: string): string => basename(value.trim())

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

      // Resolver paths
      const artifactsBasePath = join(projectRoot, artifactsDir)
      const manifestTestFileName = sanitizeTestFileName(data.manifest.testFile)
      if (!manifestTestFileName) {
        res.status(400).json({ error: 'Invalid test file name in manifest' })
        return
      }
      const lowerFileName = manifestTestFileName.toLowerCase()
      const hasAllowedExtension = Array.from(allowedTestExtensions).some((ext) =>
        lowerFileName.endsWith(ext),
      )
      if (!hasAllowedExtension) {
        res.status(400).json({ error: 'Invalid testFile extension' })
        return
      }

      // Spec file will be uploaded to artifacts/ initially
      // uploadFiles will move it to the correct path based on conventions
      const artifactDir = join(artifactsBasePath, sanitizedOutputId)
      const testFileAbsolutePath = join(artifactDir, manifestTestFileName)
      console.log('[createRun] Initial spec path (artifacts):', testFileAbsolutePath)

      // Validação para runs do tipo EXECUTION
      console.log('[createRun] Checking EXECUTION validation...')
      let contractRun: Awaited<ReturnType<typeof prisma.validationRun.findUnique>> = null
      if (data.runType === 'EXECUTION') {
        if (!data.contractRunId) {
          res.status(400).json({ error: 'contractRunId is required for EXECUTION runs' })
          return
        }

        contractRun = await prisma.validationRun.findUnique({
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
          testFilePath: testFileAbsolutePath,
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

      // Para runs de EXECUTION, copiar arquivos do CONTRACT run e enfileirar execução automaticamente
      if (data.runType === 'EXECUTION' && contractRun) {
        console.log('[createRun] Copying files from contract run to execution run...')
        try {
          // Criar diretório de artifacts para a execution run
          const executionArtifactDir = join(artifactsBasePath, sanitizedOutputId)
          await fs.mkdir(executionArtifactDir, { recursive: true })

          // Copiar plan.json do contract run
          const contractArtifactDir = join(artifactsBasePath, contractRun.outputId)
          const contractPlanPath = join(contractArtifactDir, 'plan.json')
          const executionPlanPath = join(executionArtifactDir, 'plan.json')

          try {
            await fs.copyFile(contractPlanPath, executionPlanPath)
            console.log('[createRun] Copied plan.json from contract run')
          } catch (error) {
            console.warn('[createRun] Could not copy plan.json:', error)
          }

          // Copiar spec file do contract run
          const contractManifest = JSON.parse(contractRun.manifestJson)
          const specFileName = contractManifest.testFile
          if (specFileName) {
            const contractSpecPath = contractRun.testFilePath
            const executionArtifactsSpecPath = join(executionArtifactDir, specFileName)

            try {
              // Copiar para artifacts/ primeiro
              await fs.copyFile(contractSpecPath, executionArtifactsSpecPath)
              console.log('[createRun] Copied spec file to artifacts:', executionArtifactsSpecPath)

              // Usar PathResolverService para copiar para o path correto
              const pathResolver = new PathResolverService()
              const correctSpecPath = await pathResolver.ensureCorrectPath(
                executionArtifactsSpecPath,
                data.manifest,
                projectRoot,
                sanitizedOutputId
              )
              console.log('[createRun] ✅ Spec copied to correct path:', correctSpecPath)

              // Atualizar testFilePath no banco com o path correto
              await prisma.validationRun.update({
                where: { id: run.id },
                data: { testFilePath: correctSpecPath },
              })
              console.log('[createRun] Updated run.testFilePath in database')
            } catch (error) {
              console.error('[createRun] Error copying/resolving spec file:', error)
              console.warn('[createRun] Will keep testFilePath as artifacts path')
            }
          }

          // Enfileirar execução automaticamente
          console.log('[createRun] Queueing execution run automatically...')
          orchestrator.addToQueue(run.id).catch((error) => {
            console.error(`[createRun] Error queueing execution run ${run.id}:`, error)
          })
          console.log('[createRun] Execution run queued successfully')
        } catch (error) {
          console.error('[createRun] Error copying files from contract run:', error)
        }
      } else {
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

  private detectTestType(files: Array<{ path: string; action: string }>): string | null {
    const typePatterns: Record<string, RegExp> = {
      component: /\/components?\//i,
      hook: /\/hooks?\//i,
      lib: /\/lib\//i,
      util: /\/utils?\//i,
      service: /\/services?\//i,
      context: /\/contexts?\//i,
      page: /\/pages?\//i,
      store: /\/stores?\//i,
      api: /\/api\//i,
      validator: /\/validators?\//i,
    }

    const typeCounts: Record<string, number> = {}

    for (const file of files) {
      if (file.action === 'DELETE') continue

      for (const [type, pattern] of Object.entries(typePatterns)) {
        if (pattern.test(file.path)) {
          typeCounts[type] = (typeCounts[type] || 0) + 1
        }
      }
    }

    // Return the type with the most matches
    let maxCount = 0
    let detectedType: string | null = null

    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > maxCount) {
        maxCount = count
        detectedType = type
      }
    }

    return detectedType
  }
}



