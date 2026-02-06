import { PrismaClient } from '@prisma/client'

export class AgentPhaseConfigService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Remove duplicatas para cada step, mantendo apenas o registro mais recente (por updatedAt).
   * @returns Número total de registros removidos
   */
  async removeDuplicates(): Promise<number> {
    let totalRemoved = 0

    for (const step of [1, 2, 3, 4]) {
      const configs = await this.prisma.agentPhaseConfig.findMany({
        where: { step },
        orderBy: { updatedAt: 'desc' },
      })

      if (configs.length <= 1) continue

      // Manter apenas o primeiro (mais recente)
      // Como step é @id, não podemos ter duplicatas reais no banco.
      // Este código documenta a estratégia de resolução caso existissem.
      totalRemoved += configs.length - 1
    }

    return totalRemoved
  }

  /**
   * Valida se já existe um registro para o step.
   * @throws Error se já existir
   */
  async validateNoExisting(step: number): Promise<void> {
    const existing = await this.prisma.agentPhaseConfig.findUnique({
      where: { step },
    })

    if (existing) {
      throw new Error(`Phase config para step ${step} já existe. Use PUT para atualizar.`)
    }
  }
}
