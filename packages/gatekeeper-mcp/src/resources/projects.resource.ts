/**
 * MCP Resource: gatekeeper://projects
 * Returns list of all Gatekeeper projects
 */

import type { GatekeeperClient } from '../client/GatekeeperClient.js'
import type { MCPResourceResponse } from './index.js'

export async function readProjectsResource(
  uri: string,
  client: GatekeeperClient
): Promise<MCPResourceResponse> {
  const result = await client.listProjects()

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
