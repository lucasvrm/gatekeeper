import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { GATES_CONFIG } from '../../config/gates.config.js'
import type { ValidatorCode } from '../../types/index.js'

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
      const metadata = validatorMetadataMap.get(validator.key as ValidatorCode)
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

    const metadata = validatorMetadataMap.get(name as ValidatorCode)
    res.json({
      ...updated,
      displayName: metadata?.displayName ?? updated.key,
      description: metadata?.description ?? '',
      category: metadata?.category ?? '',
      gate: metadata?.gate ?? null,
      order: metadata?.order ?? null,
      isHardBlock: metadata?.isHardBlock ?? true,
      gateCategory: validatorCategoryMap.get(name) ?? 'Desconhecida',
    })
  }

  async bulkUpdateValidators(req: Request, res: Response): Promise<void> {
    const { keys, updates } = req.body ?? {}

    if (!Array.isArray(keys) || keys.length === 0 || !updates || typeof updates !== 'object') {
      res.status(400).json({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid payload' } })
      return
    }

    const { isActive, failMode } = updates as { isActive?: unknown; failMode?: unknown }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      res.status(400).json({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid isActive value' } })
      return
    }

    if (failMode !== undefined && failMode !== null && failMode !== 'HARD' && failMode !== 'WARNING') {
      res.status(400).json({ error: { code: 'INVALID_FAIL_MODE', message: 'Invalid failMode value' } })
      return
    }

    const invalidKey = keys.find((key: unknown) => typeof key !== 'string' || !validatorKeys.has(key))
    if (invalidKey) {
      res.status(404).json({ error: { code: 'VALIDATOR_NOT_FOUND', message: `Validator ${String(invalidKey)} not found` } })
      return
    }

    if (isActive === undefined && failMode === undefined) {
      res.status(400).json({ error: { code: 'INVALID_PAYLOAD', message: 'No updates provided' } })
      return
    }

    const existing = await prisma.validationConfig.findMany({
      where: { key: { in: keys }, category: 'VALIDATOR' },
    })

    if (existing.length !== keys.length) {
      const existingKeys = new Set(existing.map((item) => item.key))
      const missing = keys.find((key: string) => !existingKeys.has(key))
      res.status(404).json({ error: { code: 'VALIDATOR_NOT_FOUND', message: `Validator ${missing ?? 'unknown'} not found` } })
      return
    }

    const data: { value?: string; failMode?: string | null } = {}
    if (isActive !== undefined) {
      data.value = isActive ? 'true' : 'false'
    }
    if (failMode !== undefined) {
      data.failMode = failMode
    }

    await prisma.validationConfig.updateMany({
      where: { key: { in: keys }, category: 'VALIDATOR' },
      data,
    })

    const updated = await prisma.validationConfig.findMany({
      where: { key: { in: keys }, category: 'VALIDATOR' },
    })
    const updatedMap = new Map(updated.map((item) => [item.key, item]))
    const ordered = keys.map((key: string) => updatedMap.get(key)).filter((item): item is typeof updated[number] => Boolean(item))

    const enriched = ordered.map((item) => {
      const metadata = validatorMetadataMap.get(item.key as ValidatorCode)
      return {
        ...item,
        displayName: metadata?.displayName ?? item.key,
        description: metadata?.description ?? '',
        category: metadata?.category ?? '',
        gate: metadata?.gate ?? null,
        order: metadata?.order ?? null,
        isHardBlock: metadata?.isHardBlock ?? true,
        gateCategory: validatorCategoryMap.get(item.key) ?? 'Desconhecida',
      }
    })

    res.json(enriched)
  }
}
