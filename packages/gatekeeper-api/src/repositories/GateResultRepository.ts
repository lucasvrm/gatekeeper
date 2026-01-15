import { prisma } from '../db/client.js'
import type { GateResult, Prisma } from '@prisma/client'

export class GateResultRepository {
  async create(data: Prisma.GateResultCreateInput): Promise<GateResult> {
    return await prisma.gateResult.create({ data })
  }

  async findByRunId(runId: string): Promise<GateResult[]> {
    return await prisma.gateResult.findMany({
      where: { runId },
      orderBy: { gateNumber: 'asc' },
    })
  }

  async update(id: string, data: Prisma.GateResultUpdateInput): Promise<GateResult> {
    return await prisma.gateResult.update({
      where: { id },
      data,
    })
  }

  async findByRunAndGate(runId: string, gateNumber: number): Promise<GateResult | null> {
    return await prisma.gateResult.findUnique({
      where: {
        runId_gateNumber: {
          runId,
          gateNumber,
        },
      },
    })
  }
}
