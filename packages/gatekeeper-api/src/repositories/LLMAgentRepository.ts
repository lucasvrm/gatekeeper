import { PrismaClient, LLMAgent } from '@prisma/client'

export class LLMAgentRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<LLMAgent[]> {
    return this.prisma.lLMAgent.findMany({
      orderBy: { sortOrder: 'asc' },
    })
  }

  async findActive(): Promise<LLMAgent[]> {
    return this.prisma.lLMAgent.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async findById(id: string): Promise<LLMAgent | null> {
    return this.prisma.lLMAgent.findUnique({
      where: { id },
    })
  }

  async findBySlug(slug: string): Promise<LLMAgent | null> {
    return this.prisma.lLMAgent.findUnique({
      where: { slug },
    })
  }

  async findDefault(): Promise<LLMAgent | null> {
    return this.prisma.lLMAgent.findFirst({
      where: { isDefault: true, isActive: true },
    })
  }

  async create(data: Omit<LLMAgent, 'id' | 'createdAt' | 'updatedAt'>): Promise<LLMAgent> {
    return this.prisma.lLMAgent.create({ data })
  }

  async update(id: string, data: Partial<LLMAgent>): Promise<LLMAgent> {
    return this.prisma.lLMAgent.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.lLMAgent.delete({
      where: { id },
    })
  }

  async setDefault(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.lLMAgent.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.lLMAgent.update({
        where: { id },
        data: { isDefault: true },
      }),
    ])
  }
}
