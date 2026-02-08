/**
 * Helper para iniciar servidor HTTP isolado para testes E2E
 */

import { resolve } from 'node:path'
import { createServer, Server } from 'http'
import { PrismaClient } from '@prisma/client'
import type { Express } from 'express'
import { OrchestratorEventService } from '@/services/OrchestratorEventService'

const defaultDbUrl = `file:${resolve(process.cwd(), 'prisma', 'test.db')}`

export class TestServer {
  private server?: Server
  private prisma: PrismaClient

  constructor(
    private port: number,
    private app: Express
  ) {
    // Inicializa Prisma Client imediatamente
    this.prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL || defaultDbUrl,
    })
  }

  async start() {
    console.log(`[TestServer] Starting test server on port ${this.port}`)

    // Conecta Prisma
    await this.prisma.$connect()
    console.log('[TestServer] Prisma connected')

    // Inicializa OrchestratorEventService com Prisma
    OrchestratorEventService.setPrisma(this.prisma)
    console.log('[TestServer] OrchestratorEventService initialized')

    // Limpa DB de teste antes de iniciar
    try {
      // Limpa em ordem de dependências (filhos antes de pais)
      await this.prisma.pipelineEvent.deleteMany()
      await this.prisma.pipelineState.deleteMany()
      await this.prisma.agentRunStep.deleteMany()
      await this.prisma.agentRun.deleteMany()
      await this.prisma.agentPhaseConfig.deleteMany()
      await this.prisma.project.deleteMany()
      await this.prisma.workspace.deleteMany()
      console.log('[TestServer] Database cleaned')
    } catch (error) {
      console.warn('[TestServer] Error cleaning database:', error)
    }

    // Inicia servidor HTTP
    this.server = createServer(this.app)
    await new Promise<void>((resolve) => {
      this.server!.listen(this.port, () => {
        console.log(`[TestServer] Listening on http://localhost:${this.port}`)
        resolve()
      })
    })
  }

  async stop() {
    console.log('[TestServer] Stopping server')

    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    await this.prisma.$disconnect()
    console.log('[TestServer] Server stopped')
  }

  getPrisma() {
    return this.prisma
  }
}
