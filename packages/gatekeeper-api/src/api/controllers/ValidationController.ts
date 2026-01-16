import type { Request, Response } from 'express'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '../../db/client.js'
import { ValidationOrchestrator } from '../../services/ValidationOrchestrator.js'
import { GATES_CONFIG } from '../../config/gates.config.js'
import type { CreateRunInput } from '../schemas/validation.schema.js'

const orchestrator = new ValidationOrchestrator()
const maxTestFileBytes = 1048576
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

const saveTestFile = async (outputId: string, fileName: string, content: string): Promise<string> => {
  const artifactsDir = join(process.cwd(), 'artifacts', outputId)
  const filePath = join(artifactsDir, fileName)
  await writeFile(filePath, content, 'utf8')
  return filePath
}

export class ValidationController {
  async createRun(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as CreateRunInput
      const sanitizedOutputId = sanitizeOutputId(data.outputId)

      if (sanitizedOutputId !== data.outputId || sanitizedOutputId.length === 0) {
        res.status(400).json({ error: 'Invalid outputId' })
        return
      }

      if (data.testFileContent) {
        const contentSize = Buffer.byteLength(data.testFileContent, 'utf8')
        if (contentSize > maxTestFileBytes) {
          res.status(413).json({ error: 'testFileContent exceeds maximum size' })
          return
        }
      }

      const testFileName = data.testFilePath.split(/[\\/]/).pop()
      const lowerFileName = testFileName?.toLowerCase() ?? ''
      const hasAllowedExtension = Array.from(allowedTestExtensions).some((ext) =>
        lowerFileName.endsWith(ext),
      )
      if (!hasAllowedExtension) {
        res.status(400).json({ error: 'Invalid testFilePath extension' })
        return
      }

      // Validação para runs do tipo EXECUTION
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

      const artifactsDir = join(process.cwd(), 'artifacts', sanitizedOutputId)
      await mkdir(artifactsDir, { recursive: true })

      if (data.testFileContent) {
        try {
          if (!testFileName) {
            res.status(400).json({ error: 'Invalid testFilePath file name' })
            return
          }

          await saveTestFile(sanitizedOutputId, testFileName, data.testFileContent)
        } catch (error) {
          res.status(500).json({
            error: 'Failed to save test file',
            message: error instanceof Error ? error.message : String(error),
          })
          return
        }
      }

      const run = await prisma.validationRun.create({
        data: {
          outputId: data.outputId,
          projectPath: data.projectPath,
          taskPrompt: data.taskPrompt,
          manifestJson: JSON.stringify(data.manifest),
          testFilePath: data.testFilePath,
          baseRef: data.baseRef,
          targetRef: data.targetRef,
          dangerMode: data.dangerMode,
          status: 'PENDING',
          runType: data.runType,
          contractRunId: data.contractRunId,
        },
      })

      orchestrator.addToQueue(run.id).catch((error) => {
        console.error(`Error executing run ${run.id}:`, error)
      })

      res.status(201).json({
        runId: run.id,
        outputId: run.outputId,
        status: run.status,
        createdAt: run.createdAt,
      })
    } catch (error) {
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
