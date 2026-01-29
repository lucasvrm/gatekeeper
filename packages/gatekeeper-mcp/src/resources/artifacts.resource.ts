/**
 * MCP Resource: gatekeeper://artifacts/{outputId}/{filename}
 * Returns artifact file contents
 */

import type { GatekeeperClient } from '../client/GatekeeperClient.js'
import type { MCPResourceResponse } from './index.js'
import { createMCPError } from './index.js'

export interface ArtifactUriParts {
  outputId: string
  filename: string
}

export function parseArtifactUri(uri: string): ArtifactUriParts | null {
  const match = uri.match(/^gatekeeper:\/\/artifacts\/([^/]+)\/(.+)$/)
  if (!match) return null

  return {
    outputId: match[1],
    filename: match[2],
  }
}

export async function readArtifactsResource(
  uri: string,
  outputId: string,
  filename: string,
  client: GatekeeperClient
): Promise<MCPResourceResponse> {
  const contents = await client.getArtifactContents(outputId)

  let text: string | undefined
  let mimeType = 'text/plain'

  if (filename === 'plan.json' && contents.planJson) {
    text = JSON.stringify(contents.planJson, null, 2)
    mimeType = 'application/json'
  } else if ((filename === 'spec.ts' || filename === contents.specFileName) && contents.specContent) {
    text = contents.specContent
    mimeType = 'text/typescript'
  } else if (filename === 'contract.md') {
    // Contract might be embedded in planJson
    const plan = contents.planJson as { contract?: unknown } | null
    if (plan?.contract) {
      text = JSON.stringify(plan.contract, null, 2)
      mimeType = 'application/json'
    }
  }

  if (!text) {
    throw createMCPError(-32602, `Artifact not found: ${filename}`)
  }

  return {
    contents: [
      {
        uri,
        mimeType,
        text,
      },
    ],
  }
}
