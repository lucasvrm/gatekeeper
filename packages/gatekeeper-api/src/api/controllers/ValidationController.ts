import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { ValidationOrchestrator } from '../../services/ValidationOrchestrator.js'
import { GATES_CONFIG } from '../../config/gates.config.js'
import type { CreateRunInput } from '../schemas/validation.schema.js'

const orchestrator = new ValidationOrchestrator()

export class ValidationController {
  async createRun(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as CreateRunInput

      const run = await prisma.validationRun.create({
        data: {
          projectPath: data.projectPath,
          taskPrompt: data.taskPrompt,
          manifestJson: data.manifest ? JSON.stringify(data.manifest) : null,
          testFilePath: data.testFilePath || null,
          baseRef: data.baseRef,
          targetRef: data.targetRef,
          dangerMode: data.dangerMode,
          status: 'PENDING',
        },
      })

      orchestrator.addToQueue(run.id).catch((error) => {
        console.error(`Error executing run ${run.id}:`, error)
      })

      res.status(201).json({
        runId: run.id,
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
