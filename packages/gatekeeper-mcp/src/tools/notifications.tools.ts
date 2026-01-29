/**
 * Notification Tools
 * Tools for configuring notifications
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolContext, ToolResult } from './index.js'

// Mutable notification config state
let notificationConfig = {
  desktop: true,
  sound: true,
}

export function initNotificationConfig(config: { desktop: boolean; sound: boolean }): void {
  notificationConfig = { ...config }
}

export function getNotificationConfig(): { desktop: boolean; sound: boolean } {
  return { ...notificationConfig }
}

export const notificationTools: Tool[] = [
  {
    name: 'configure_notifications',
    description: 'Configure notification preferences',
    inputSchema: {
      type: 'object',
      properties: {
        desktop: { type: 'boolean', description: 'Enable desktop notifications' },
        sound: { type: 'boolean', description: 'Enable sound notifications' },
      },
    },
  },
]

export async function handleNotificationTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'configure_notifications': {
        const { desktop, sound } = args as { desktop?: boolean; sound?: boolean }

        // Update the mutable config
        if (desktop !== undefined) {
          notificationConfig.desktop = desktop
          ctx.config.NOTIFICATIONS_DESKTOP = desktop
        }
        if (sound !== undefined) {
          notificationConfig.sound = sound
          ctx.config.NOTIFICATIONS_SOUND = sound
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                desktop: notificationConfig.desktop,
                sound: notificationConfig.sound,
              }),
            },
          ],
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown notification tool: ${name}` }],
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
