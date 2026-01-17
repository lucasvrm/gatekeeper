import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Server } from 'node:http'
import { PrismaClient } from '@prisma/client'
import app from '../src/server.js'

describe('agents.routes', () => {
  const prisma = new PrismaClient()
  let server: Server
  let baseUrl: string

  const createAgent = async (name: string, slug: string, overrides: Partial<Parameters<typeof prisma.lLMAgent.create>[0]['data']> = {}) => {
    return prisma.lLMAgent.create({
      data: {
        name,
        slug,
        provider: 'openai',
        model: 'gpt-4-turbo',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 256,
        isActive: true,
        isDefault: false,
        sortOrder: 0,
        ...overrides,
      },
    })
  }

  const request = async (
    path: string,
    options: { method?: string; body?: string; headers?: Record<string, string> } = {}
  ) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })

    return response
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start test server')
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it('lists agents', async () => {
    await createAgent('Agent One', 'agent-one')
    await createAgent('Agent Two', 'agent-two')

    const response = await request('/api/agents')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.length).toBe(2)
  })

  it('gets agent by id', async () => {
    const agent = await createAgent('Agent Get', 'agent-get')

    const response = await request(`/api/agents/${agent.id}`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe(agent.id)
  })

  it('returns 404 for missing agent', async () => {
    const response = await request('/api/agents/does-not-exist')
    expect(response.status).toBe(404)
  })

  it('creates agent', async () => {
    const response = await request('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Agent Create',
        provider: 'openai',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        maxTokens: 512,
      }),
    })

    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.slug).toBe('agent-create')
  })

  it('returns 400 for duplicate agent name', async () => {
    await request('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Agent Duplicate',
        provider: 'openai',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        maxTokens: 512,
      }),
    })

    const response = await request('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Agent Duplicate',
        provider: 'openai',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        maxTokens: 512,
      }),
    })

    expect(response.status).toBe(400)
  })

  it('updates agent', async () => {
    const agent = await createAgent('Agent Update', 'agent-update')

    const response = await request(`/api/agents/${agent.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.isActive).toBe(false)
  })

  it('deletes agent', async () => {
    const agent = await createAgent('Agent Delete', 'agent-delete')

    const response = await request(`/api/agents/${agent.id}`, { method: 'DELETE' })
    expect(response.status).toBe(204)

    const check = await prisma.lLMAgent.findUnique({ where: { id: agent.id } })
    expect(check).toBeNull()
  })

  it('sets default agent', async () => {
    const one = await createAgent('Agent Default One', 'agent-default-one')
    const two = await createAgent('Agent Default Two', 'agent-default-two')

    const response = await request(`/api/agents/${two.id}/default`, { method: 'POST' })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.isDefault).toBe(true)

    const refreshedOne = await prisma.lLMAgent.findUnique({ where: { id: one.id } })
    expect(refreshedOne?.isDefault).toBe(false)
  })
})
