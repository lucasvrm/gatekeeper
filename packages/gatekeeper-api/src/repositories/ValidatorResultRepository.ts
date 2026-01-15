import { prisma } from '../db/client.js'
import type { ValidatorResult, Prisma } from '@prisma/client'

export class ValidatorResultRepository {
  async create(data: Prisma.ValidatorResultCreateInput): Promise<ValidatorResult> {
    return await prisma.validatorResult.create({ data })
  }

  async findByRunId(runId: string): Promise<ValidatorResult[]> {
    return await prisma.validatorResult.findMany({
      where: { runId },
      orderBy: [{ gateNumber: 'asc' }, { validatorOrder: 'asc' }],
    })
  }

  async update(id: string, data: Prisma.ValidatorResultUpdateInput): Promise<ValidatorResult> {
    return await prisma.validatorResult.update({
      where: { id },
      data,
    })
  }

  async findByRunAndCode(runId: string, validatorCode: string): Promise<ValidatorResult | null> {
    return await prisma.validatorResult.findUnique({
      where: {
        runId_validatorCode: {
          runId,
          validatorCode,
        },
      },
    })
  }
}
