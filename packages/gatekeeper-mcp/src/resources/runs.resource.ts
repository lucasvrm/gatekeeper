/**
 * MCP Resource: gatekeeper://runs/recent
 * Returns list of recent validation runs
 */

import type { GatekeeperClient } from '../client/GatekeeperClient.js'
import type { MCPResourceResponse } from './index.js'

export async function readRunsResource(
  uri: string,
  client: GatekeeperClient
): Promise<MCPResourceResponse> {
  const result = await client.listRuns({ limit: 10 })

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(result),
      },
    ],
  }
}
