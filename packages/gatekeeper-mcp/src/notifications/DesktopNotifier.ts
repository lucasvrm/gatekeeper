/**
 * Desktop Notifier
 * Sends desktop notifications using node-notifier
 */

import type { INotifier, NotificationOptions } from './INotifier.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeNotifierType = any

export class DesktopNotifier implements INotifier {
  private notifier: NodeNotifierType = null

  constructor() {
    // Lazy load node-notifier
    this.loadNotifier()
  }

  private async loadNotifier(): Promise<void> {
    try {
      const nodeNotifier = await import('node-notifier')
      this.notifier = nodeNotifier.default || nodeNotifier
    } catch {
      // node-notifier not available
      this.notifier = null
    }
  }

  async notify(options: NotificationOptions): Promise<void> {
    if (!this.notifier) {
      await this.loadNotifier()
    }

    if (!this.notifier) {
      // Silently fail if node-notifier is not available
      return
    }

    this.notifier.notify({
      title: options.title,
      message: options.message,
      sound: false, // Sound handled separately
    })
  }
}
