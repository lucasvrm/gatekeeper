import { PrismaClient, ElicitationMessage, ElicitationSession } from '@prisma/client'

import { SessionStatus } from '../elicitor/types/elicitor.types.js'

export class ElicitationSessionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    outputId: string
    agentId: string
    initialPrompt: string
    detectedType: string
  }): Promise<ElicitationSession> {
    return this.prisma.elicitationSession.create({ data })
  }

  async findById(id: string): Promise<ElicitationSession | null> {
    return this.prisma.elicitationSession.findUnique({
      where: { id },
      include: { messages: true, agent: true },
    })
  }

  async findByOutputId(outputId: string): Promise<ElicitationSession | null> {
    return this.prisma.elicitationSession.findUnique({
      where: { outputId },
      include: { messages: true, agent: true },
    })
  }

  async findRecent(limit: number = 10): Promise<ElicitationSession[]> {
    return this.prisma.elicitationSession.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { agent: true },
    })
  }

  async update(id: string, data: Partial<ElicitationSession>): Promise<ElicitationSession> {
    return this.prisma.elicitationSession.update({
      where: { id },
      data,
    })
  }

  async complete(id: string, data: {
    completenessScore: number
    taskPrompt: string
    planJson: string
    totalDurationMs: number
  }): Promise<ElicitationSession> {
    return this.prisma.elicitationSession.update({
      where: { id },
      data: {
        ...data,
        status: SessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    })
  }

  async addMessage(sessionId: string, data: {
    role: string
    content: string
    round: number
    tokensIn?: number
    tokensOut?: number
    durationMs?: number
    questionId?: string
    wasDefault?: boolean
  }): Promise<ElicitationMessage> {
    if (data.tokensIn || data.tokensOut) {
      await this.prisma.elicitationSession.update({
        where: { id: sessionId },
        data: {
          totalTokensIn: { increment: data.tokensIn || 0 },
          totalTokensOut: { increment: data.tokensOut || 0 },
          currentRound: data.round,
        },
      })
    }

    return this.prisma.elicitationMessage.create({
      data: { sessionId, ...data },
    })
  }

  async getMessages(sessionId: string): Promise<ElicitationMessage[]> {
    return this.prisma.elicitationMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    })
  }
}
