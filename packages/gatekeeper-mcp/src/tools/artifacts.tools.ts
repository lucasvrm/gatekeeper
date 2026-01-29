/**
 * Artifact Tools
 * Tools for managing artifact files locally
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolContext, ToolResult } from './index.js'

export const artifactTools: Tool[] = [
  {
    name: 'save_artifact',
    description: 'Save a file to the artifacts directory',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: { type: 'string', description: 'Output ID (folder name)' },
        filename: { type: 'string', description: 'Filename to save' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['outputId', 'filename', 'content'],
    },
  },
  {
    name: 'read_artifact',
    description: 'Read a file from artifacts directory',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: { type: 'string', description: 'Output ID (folder name)' },
        filename: { type: 'string', description: 'Filename to read' },
      },
      required: ['outputId', 'filename'],
    },
  },
  {
    name: 'list_artifacts',
    description: 'List artifact folders or files within a folder',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: { type: 'string', description: 'If provided, list files in this folder' },
      },
    },
  },
  {
    name: 'delete_artifact',
    description: 'Delete an artifact file or folder',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: { type: 'string', description: 'Output ID (folder name)' },
        filename: { type: 'string', description: 'Filename to delete. If omitted, deletes entire folder' },
      },
      required: ['outputId'],
    },
  },
]

/**
 * Validates path to prevent directory traversal attacks
 */
function isPathSafe(inputPath: string): boolean {
  return !inputPath.includes('..')
}

export async function handleArtifactTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'save_artifact': {
        const { outputId, filename, content } = args as {
          outputId: string
          filename: string
          content: string
        }

        if (!outputId || !filename || content === undefined) {
          return {
            content: [{ type: 'text', text: 'Missing required fields: outputId, filename, content' }],
            isError: true,
          }
        }

        // Security check for path traversal
        if (!isPathSafe(outputId) || !isPathSafe(filename)) {
          return {
            content: [{ type: 'text', text: 'Invalid path: path traversal not allowed' }],
            isError: true,
          }
        }

        const artifactPath = path.join(ctx.config.ARTIFACTS_DIR, outputId, filename)
        const dir = path.dirname(artifactPath)

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(artifactPath, content, 'utf-8')
        return { content: [{ type: 'text', text: JSON.stringify({ path: artifactPath }) }] }
      }

      case 'read_artifact': {
        const { outputId, filename } = args as { outputId: string; filename: string }

        if (!outputId || !filename) {
          return {
            content: [{ type: 'text', text: 'Missing required fields: outputId, filename' }],
            isError: true,
          }
        }

        const artifactPath = path.join(ctx.config.ARTIFACTS_DIR, outputId, filename)

        if (!fs.existsSync(artifactPath)) {
          return {
            content: [{ type: 'text', text: `Artifact not found: ${artifactPath}` }],
            isError: true,
          }
        }

        const content = fs.readFileSync(artifactPath, 'utf-8')
        return { content: [{ type: 'text', text: content }] }
      }

      case 'list_artifacts': {
        const { outputId } = args as { outputId?: string }

        if (outputId) {
          // List files in a specific folder
          const dir = path.join(ctx.config.ARTIFACTS_DIR, outputId)

          if (!fs.existsSync(dir)) {
            return { content: [{ type: 'text', text: JSON.stringify([]) }] }
          }

          const files = fs.readdirSync(dir).map(f => ({ filename: f }))
          return { content: [{ type: 'text', text: JSON.stringify(files) }] }
        } else {
          // List all folders
          if (!fs.existsSync(ctx.config.ARTIFACTS_DIR)) {
            return { content: [{ type: 'text', text: JSON.stringify([]) }] }
          }

          const folders = fs.readdirSync(ctx.config.ARTIFACTS_DIR)
            .filter(f => fs.statSync(path.join(ctx.config.ARTIFACTS_DIR, f)).isDirectory())
            .map(f => ({ outputId: f }))

          return { content: [{ type: 'text', text: JSON.stringify(folders) }] }
        }
      }

      case 'delete_artifact': {
        const { outputId, filename } = args as { outputId: string; filename?: string }

        if (!outputId) {
          return {
            content: [{ type: 'text', text: 'Missing required field: outputId' }],
            isError: true,
          }
        }

        if (filename) {
          // Delete specific file
          const artifactPath = path.join(ctx.config.ARTIFACTS_DIR, outputId, filename)

          if (!fs.existsSync(artifactPath)) {
            return {
              content: [{ type: 'text', text: `Artifact not found: ${artifactPath}` }],
              isError: true,
            }
          }

          fs.unlinkSync(artifactPath)
          return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] }
        } else {
          // Delete entire folder
          const folderPath = path.join(ctx.config.ARTIFACTS_DIR, outputId)

          if (!fs.existsSync(folderPath)) {
            return {
              content: [{ type: 'text', text: `Artifact folder not found: ${folderPath}` }],
              isError: true,
            }
          }

          fs.rmSync(folderPath, { recursive: true, force: true })
          return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] }
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown artifact tool: ${name}` }],
          isError: true,
        }
    }
  } catch (error) {
    const err = error as Error
    return {
      content: [{ type: 'text', text: `error: ${err.message}` }],
      isError: true,
    }
  }
}
