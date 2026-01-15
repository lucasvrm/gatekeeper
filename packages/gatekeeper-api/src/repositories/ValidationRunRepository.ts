import { prisma } from '../db/client.js'
import type { ValidationRun, Prisma } from '@prisma/client'

export class ValidationRunRepository {
  async create(data: Prisma.ValidationRunCreateInput): Promise<ValidationRun> {
    return await prisma.validationRun.create({ data })
  }

  async findById(id: string): Promise<ValidationRun | null> {
    return await prisma.validationRun.findUnique({
      where: { id },
      include: {
        gateResults: true,
        validatorResults: true,
        logs: true,
        manifestFiles: true,
      },
    })
  }

  async findAll(options?: {
    skip?: number
    take?: number
    where?: Prisma.ValidationRunWhereInput
  }): Promise<ValidationRun[]> {
    return await prisma.validationRun.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async update(id: string, data: Prisma.ValidationRunUpdateInput): Promise<ValidationRun> {
    return await prisma.validationRun.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<ValidationRun> {
    return await prisma.validationRun.delete({
      where: { id },
    })
  }

  async findByStatus(status: string): Promise<ValidationRun[]> {
    return await prisma.validationRun.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    })
  }
}
