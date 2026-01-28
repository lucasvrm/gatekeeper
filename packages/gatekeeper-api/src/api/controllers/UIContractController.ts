import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { UIContractRepository } from '../../repositories/UIContractRepository.js'
import { UIContractValidatorService } from '../../services/UIContractValidatorService.js'
import type { UIContractSchema } from '../../types/ui-contract.types.js'

export class UIContractController {
  private repository = new UIContractRepository()
  private validator = new UIContractValidatorService()

  /**
   * GET /api/projects/:projectId/ui-contract
   * Retorna contrato existente ou 404
   */
  async getContract(req: Request, res: Response): Promise<void> {
    const { projectId } = req.params

    // Verificar se projeto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      })
      return
    }

    // Buscar contrato
    const uiContract = await this.repository.findByProjectId(projectId)

    if (!uiContract) {
      res.status(404).json({
        error: {
          code: 'CONTRACT_NOT_FOUND',
          message: 'UI Contract not found for this project',
        },
      })
      return
    }

    res.status(200).json({
      id: uiContract.id,
      projectId: uiContract.projectId,
      version: uiContract.version,
      hash: uiContract.hash,
      uploadedAt: uiContract.uploadedAt,
      contract: JSON.parse(uiContract.contractJson),
    })
  }

  /**
   * POST /api/projects/:projectId/ui-contract
   * Cria novo contrato (201) ou atualiza existente (200)
   */
  async createOrUpdate(req: Request, res: Response): Promise<void> {
    const { projectId } = req.params
    const contractData = req.body as UIContractSchema

    // Verificar se projeto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      })
      return
    }

    // Validar schema
    const validation = this.validator.validate(contractData)

    if (!validation.valid) {
      res.status(400).json({
        error: {
          code: 'INVALID_CONTRACT',
          message: 'Contract validation failed',
          details: validation.errors,
        },
      })
      return
    }

    // Verificar se contrato já existe
    const exists = await this.repository.exists(projectId)

    // Upsert contrato
    const uiContract = await this.repository.upsert(projectId, {
      contractJson: JSON.stringify(contractData),
      version: contractData.version,
      hash: contractData.metadata.hash,
    })

    const statusCode = exists ? 200 : 201

    res.status(statusCode).json({
      success: true,
      id: uiContract.id,
      hash: uiContract.hash,
      uploadedAt: uiContract.uploadedAt,
    })
  }

  /**
   * DELETE /api/projects/:projectId/ui-contract
   * Remove contrato e retorna 204
   */
  async deleteContract(req: Request, res: Response): Promise<void> {
    const { projectId } = req.params

    // Verificar se projeto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      })
      return
    }

    // Verificar se contrato existe
    const exists = await this.repository.exists(projectId)

    if (!exists) {
      res.status(404).json({
        error: {
          code: 'CONTRACT_NOT_FOUND',
          message: 'UI Contract not found for this project',
        },
      })
      return
    }

    // Deletar contrato
    await this.repository.delete(projectId)

    res.status(204).send()
  }
}
