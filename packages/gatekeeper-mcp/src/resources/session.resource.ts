/**
 * MCP Resource: gatekeeper://session
 * Returns current session configuration
 */

import type { Config } from '../config.js'
import type { MCPResourceResponse } from './index.js'

export async function readSessionResource(
  uri: string,
  config: Config
): Promise<MCPResourceResponse> {
  const sessionData = {
    apiUrl: config.GATEKEEPER_API_URL,
    docsDir: config.DOCS_DIR,
    artifactsDir: config.ARTIFACTS_DIR,
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(sessionData),
      },
    ],
  }
}
