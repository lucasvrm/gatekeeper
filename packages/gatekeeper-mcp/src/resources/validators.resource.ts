/**
 * MCP Resource: gatekeeper://validators
 * Returns list of all available validators
 */

import type { GatekeeperClient } from '../client/GatekeeperClient.js'
import type { MCPResourceResponse } from './index.js'

export async function readValidatorsResource(
  uri: string,
  client: GatekeeperClient
): Promise<MCPResourceResponse> {
  const result = await client.listValidators()

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
