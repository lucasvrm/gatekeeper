import { prisma } from '../db/client.js'
import type { UIContract, Prisma } from '@prisma/client'

export class UIContractRepository {
  /**
   * Encontra contrato por projectId
   * @returns UIContract se existe, null se não existe
   */
  async findByProjectId(projectId: string): Promise<UIContract | null> {
    return await prisma.uIContract.findUnique({
      where: { projectId },
    })
  }

  /**
   * Cria ou atualiza contrato (upsert)
   * @returns UIContract criado ou atualizado
   */
  async upsert(
    projectId: string,
    data: {
      contractJson: string
      version: string
      hash: string
    }
  ): Promise<UIContract> {
    return await prisma.uIContract.upsert({
      where: { projectId },
      create: {
        projectId,
        contractJson: data.contractJson,
        version: data.version,
        hash: data.hash,
      },
      update: {
        contractJson: data.contractJson,
        version: data.version,
        hash: data.hash,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Remove contrato
   */
  async delete(projectId: string): Promise<UIContract> {
    return await prisma.uIContract.delete({
      where: { projectId },
    })
  }

  /**
   * Verifica se contrato existe
   * @returns true se existe, false se não existe
   */
  async exists(projectId: string): Promise<boolean> {
    const count = await prisma.uIContract.count({
      where: { projectId },
    })
    return count > 0
  }
}
