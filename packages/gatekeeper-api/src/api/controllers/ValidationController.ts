import type { Request, Response } from 'express'
import { basename, join } from 'path'
import { prisma } from '../../db/client.js'
import { ValidationOrchestrator } from '../../services/ValidationOrchestrator.js'
import { GATES_CONFIG } from '../../config/gates.config.js'
import type { CreateRunInput } from '../schemas/validation.schema.js'

const orchestrator = new ValidationOrchestrator()
const PATH_CONFIG_KEYS = {
  projectRoot: 'PROJECT_ROOT',
  backendWorkspace: 'BACKEND_WORKSPACE',
  artifactsDir: 'ARTIFACTS_DIR',
} as const
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

      // Ler configs - source of truth
      console.log('[createRun] Fetching path configs...')
      const pathConfigs = await prisma.validationConfig.findMany({
        where: { key: { in: Object.values(PATH_CONFIG_KEYS) } },
      })
      console.log('[createRun] Path configs:', pathConfigs)
      const configMap = new Map(pathConfigs.map((config) => [config.key, config.value]))

      const projectRoot = configMap.get(PATH_CONFIG_KEYS.projectRoot)?.trim() || ''
      const artifactsDir = configMap.get(PATH_CONFIG_KEYS.artifactsDir)?.trim() || 'artifacts'
      console.log('[createRun] projectRoot:', projectRoot)
      console.log('[createRun] artifactsDir:', artifactsDir)

      // Validar PROJECT_ROOT obrigatório
      if (!projectRoot) {
        console.log('[createRun] PROJECT_ROOT is empty!')
        res.status(500).json({ error: 'PROJECT_ROOT config is required. Please configure it in /config.' })
        return
      }

      // Resolver paths
      const projectPath = projectRoot
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

      // Detect test type and resolve path using convention
      console.log('[createRun] Detecting test type from manifest...')
      const detectedTestType = this.detectTestType(data.manifest.files)
      console.log('[createRun] Detected test type:', detectedTestType)

      let testFileAbsolutePath: string
      const artifactDir = join(artifactsBasePath, sanitizedOutputId)

      if (detectedTestType) {
        const convention = await prisma.testPathConvention.findFirst({
          where: { testType: detectedTestType, isActive: true },
        })

        if (convention) {
          console.log('[createRun] Found convention:', convention.pathPattern)
          // Extract base name from test file (remove .spec.tsx or .spec.ts)
          const baseName = manifestTestFileName
            .replace(/\.spec\.(tsx?|jsx?)$/, '')
            .replace(/\.test\.(tsx?|jsx?)$/, '')

          // Resolve pattern: replace {name} with base name
          const resolvedPattern = convention.pathPattern.replace(/{name}/g, baseName)
          testFileAbsolutePath = join(projectRoot, resolvedPattern)
          console.log('[createRun] Resolved test path:', testFileAbsolutePath)
        } else {
          console.log('[createRun] No convention found, using artifacts')
          testFileAbsolutePath = join(artifactDir, manifestTestFileName)
        }
      } else {
        console.log('[createRun] Could not detect test type, using artifacts')
        testFileAbsolutePath = join(artifactDir, manifestTestFileName)
      }

      // Validação para runs do tipo EXECUTION
      console.log('[createRun] Checking EXECUTION validation...')
      if (data.runType === 'EXECUTION') {
        if (!data.contractRunId) {
          res.status(400).json({ error: 'contractRunId is required for EXECUTION runs' })
          return
        }

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
          outputId: data.outputId,
          projectPath: projectPath,
          taskPrompt: data.taskPrompt,
          manifestJson: JSON.stringify(data.manifest),
          testFilePath: testFileAbsolutePath,
          baseRef: data.baseRef,
          targetRef: data.targetRef,
          dangerMode: data.dangerMode,
          status: 'PENDING',
          runType: data.runType,
          contractRunId: data.contractRunId,
          contractJson: data.contract ? JSON.stringify(data.contract) : null,
        },
      })

      console.log('[createRun] Run created:', run.id)
      console.log('[createRun] Run is in PENDING state, waiting for file upload to start execution...')

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



