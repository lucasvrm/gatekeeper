/**
 * MCP Resources Registry
 * Registers and handles all Gatekeeper resources
 */

import type { Resource, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import type { GatekeeperClient } from '../client/GatekeeperClient.js'
import type { Config } from '../config.js'
import { readProjectsResource } from './projects.resource.js'
import { readValidatorsResource } from './validators.resource.js'
import { readRunsResource } from './runs.resource.js'
import { readSessionResource } from './session.resource.js'
import { readArtifactsResource, parseArtifactUri } from './artifacts.resource.js'

export interface MCPResourceContent {
  uri: string
  mimeType: string
  text?: string
  blob?: string
}

export type MCPResourceResponse = ReadResourceResult

export interface MCPError {
  code: number
  message: string
  data?: unknown
}

export function registerResources(_config: Config): Resource[] {
  return [
    {
      uri: 'gatekeeper://projects',
      name: 'Projects',
      description: 'List of all Gatekeeper projects',
      mimeType: 'application/json',
    },
    {
      uri: 'gatekeeper://validators',
      name: 'Validators',
      description: 'List of all available validators',
      mimeType: 'application/json',
    },
    {
      uri: 'gatekeeper://runs/recent',
      name: 'Recent Runs',
      description: 'List of recent validation runs',
      mimeType: 'application/json',
    },
    {
      uri: 'gatekeeper://session',
      name: 'Session',
      description: 'Current session configuration',
      mimeType: 'application/json',
    },
    {
      uri: 'gatekeeper://artifacts/{outputId}/{filename}',
      name: 'Artifacts',
      description: 'Access artifact files by outputId and filename',
      mimeType: 'application/json',
    },
  ]
}

export async function handleReadResource(
  uri: string,
  client: GatekeeperClient,
  config: Config
): Promise<ReadResourceResult> {
  try {
    // Check for artifacts pattern first
    const artifactParts = parseArtifactUri(uri)
    if (artifactParts) {
      return readArtifactsResource(uri, artifactParts.outputId, artifactParts.filename, client)
    }

    // Handle static resources
    switch (uri) {
      case 'gatekeeper://projects':
        return readProjectsResource(uri, client)

      case 'gatekeeper://validators':
        return readValidatorsResource(uri, client)

      case 'gatekeeper://runs/recent':
        return readRunsResource(uri, client)

      case 'gatekeeper://session':
        return readSessionResource(uri, config)

      default:
        throw createMCPError(-32602, `Invalid resource URI: ${uri}`)
    }
  } catch (error) {
    const err = error as Error & { code?: string | number; status?: number }

    // Already an MCP error
    if (typeof err.code === 'number') {
      throw error
    }

    // Connection error
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      throw createMCPError(-32603, 'Gatekeeper API unavailable')
    }

    // HTTP 404
    if (err.status === 404) {
      throw createMCPError(-32602, 'Resource not found')
    }

    // Generic error
    throw createMCPError(-32603, err.message || 'Internal error')
  }
}

export function createMCPError(code: number, message: string, data?: unknown): MCPError {
  const error = new Error(message) as Error & MCPError
  error.code = code
  error.message = message
  if (data !== undefined) {
    error.data = data
  }
  return error
}
