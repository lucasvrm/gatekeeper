/**
 * MCP Tools Registry
 * Exports all tool definitions and handlers
 */

import type { Tool, CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js'
import type { GatekeeperClient } from '../client/GatekeeperClient.js'
import type { Config } from '../config.js'
import { projectTools, handleProjectTool } from './projects.tools.js'
import { runTools, handleRunTool } from './runs.tools.js'
import { validatorTools, handleValidatorTool } from './validators.tools.js'
import { artifactTools, handleArtifactTool } from './artifacts.tools.js'
import { sessionTools, handleSessionTool } from './session.tools.js'
import { notificationTools, handleNotificationTool } from './notifications.tools.js'

export interface ToolContext {
  client: GatekeeperClient
  config: Config
}

export interface ToolResult {
  content: TextContent[]
  isError?: boolean
}

/**
 * Get all registered tools
 */
export function getAllTools(): Tool[] {
  return [
    ...projectTools,
    ...runTools,
    ...validatorTools,
    ...artifactTools,
    ...sessionTools,
    ...notificationTools,
  ]
}

/**
 * Handle a tool call
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  // Project tools
  if (projectTools.some(t => t.name === name)) {
    return handleProjectTool(name, args, ctx)
  }

  // Run tools
  if (runTools.some(t => t.name === name)) {
    return handleRunTool(name, args, ctx)
  }

  // Validator tools
  if (validatorTools.some(t => t.name === name)) {
    return handleValidatorTool(name, args, ctx)
  }

  // Artifact tools
  if (artifactTools.some(t => t.name === name)) {
    return handleArtifactTool(name, args, ctx)
  }

  // Session tools
  if (sessionTools.some(t => t.name === name)) {
    return handleSessionTool(name, args, ctx)
  }

  // Notification tools
  if (notificationTools.some(t => t.name === name)) {
    return handleNotificationTool(name, args, ctx)
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  }
}
