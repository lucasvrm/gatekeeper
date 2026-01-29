import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { GATES_CONFIG } from '../../config/gates.config.js'

const validatorKeys = new Set<string>(GATES_CONFIG.flatMap((gate) => gate.validators.map((validator) => validator.code)))
const gateCategoryLabels: Record<number, string> = {
  0: 'Sanitização',
  1: 'Contratos/Testes',
  2: 'Execução',
  3: 'Integridade',
}
const validatorMetadataMap = new Map(
  GATES_CONFIG.flatMap((gate) =>
    gate.validators.map((validator) => [
      validator.code,
      {
        displayName: validator.name,
        description: validator.description ?? '',
        gate: gate.number,
        order: validator.order ?? 1,
        isHardBlock: validator.isHardBlock ?? true,
        category: gate.name,
      },
    ]),
  ),
)
const validatorCategoryMap = new Map<string, string>(
  GATES_CONFIG.flatMap((gate) =>
    gate.validators.map((validator) => [
      validator.code,
      gateCategoryLabels[gate.number] ?? gate.name,
    ]),
  ),
)

export class ValidatorController {
  async listValidators(req: Request, res: Response): Promise<void> {
    const keys = Array.from(validatorKeys)
    const validators = await prisma.validationConfig.findMany({
      where: { key: { in: keys }, category: 'VALIDATOR' },
      orderBy: { key: 'asc' },
    })

    const response = validators.map((validator) => {
      const metadata = validatorMetadataMap.get(validator.key)
      return {
        ...validator,
        failMode: validator.failMode,
        displayName: metadata?.displayName ?? validator.key,
        description: metadata?.description ?? '',
        category: metadata?.category ?? '',
        gate: metadata?.gate ?? null,
        order: metadata?.order ?? null,
        isHardBlock: metadata?.isHardBlock ?? true,
        gateCategory: validatorCategoryMap.get(validator.key) ?? 'Desconhecida',
      }
    })
    res.json(response)
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
    const { isActive, failMode } = req.body

    if (!validatorKeys.has(name)) {
      res.status(404).json({ message: 'Validator not found' })
      return
    }

    // Validate isActive if provided
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'Invalid isActive value' })
      return
    }

    // Validate failMode if provided
    if (failMode !== undefined && failMode !== null && failMode !== 'HARD' && failMode !== 'WARNING') {
      res.status(400).json({ message: 'Invalid failMode' })
      return
    }

    const existing = await prisma.validationConfig.findFirst({
      where: { key: name, category: 'VALIDATOR' },
    })

    if (!existing) {
      res.status(404).json({ message: 'Validator not found' })
      return
    }

    const data: { value?: string; failMode?: string | null } = {}
    if (isActive !== undefined) {
      data.value = isActive ? 'true' : 'false'
    }
    if (failMode !== undefined) {
      data.failMode = failMode
    }

    const updated = await prisma.validationConfig.update({
      where: { key: name },
      data,
    })

    res.json(updated)
  }
}
