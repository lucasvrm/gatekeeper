import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { GATES_CONFIG } from '../../config/gates.config.js'

const validatorKeys = new Set(GATES_CONFIG.flatMap((gate) => gate.validators.map((validator) => validator.code)))

export class ValidatorController {
  async listValidators(req: Request, res: Response): Promise<void> {
    const keys = Array.from(validatorKeys)
    const validators = await prisma.validationConfig.findMany({
      where: { key: { in: keys }, category: 'VALIDATOR' },
      orderBy: { key: 'asc' },
    })
    res.json(validators)
  }

  async getValidator(req: Request, res: Response): Promise<void> {
    const { name } = req.params

    if (!validatorKeys.has(name)) {
      res.status(404).json({ message: 'Validator not found' })
      return
    }

    const validator = await prisma.validationConfig.findFirst({
      where: { key: name, category: 'VALIDATOR' },
    })

    if (!validator) {
      res.status(404).json({ message: 'Validator not found' })
      return
    }

    res.json(validator)
  }

  async updateValidator(req: Request, res: Response): Promise<void> {
    const { name } = req.params
    const { isActive } = req.body

    if (!validatorKeys.has(name)) {
      res.status(404).json({ message: 'Validator not found' })
      return
    }

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'Invalid isActive value' })
      return
    }

    const existing = await prisma.validationConfig.findFirst({
      where: { key: name, category: 'VALIDATOR' },
    })

    if (!existing) {
      res.status(404).json({ message: 'Validator not found' })
      return
    }

    const updated = await prisma.validationConfig.update({
      where: { key: name },
      data: { value: isActive ? 'true' : 'false' },
    })

    res.json(updated)
  }
}
