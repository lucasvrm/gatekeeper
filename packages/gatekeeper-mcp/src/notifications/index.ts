/**
 * Notification Manager
 * Orchestrates desktop and sound notifications based on run events
 */

import type { Config } from '../config.js'
import type { RunStatus } from '../client/types.js'
import { DesktopNotifier } from './DesktopNotifier.js'
import { SoundNotifier } from './SoundNotifier.js'

export interface NotificationConfig {
  desktop: boolean
  sound: boolean
}

export class NotificationManager {
  private desktopNotifier: DesktopNotifier
  private soundNotifier: SoundNotifier
  private config: NotificationConfig

  constructor(config: Config) {
    this.desktopNotifier = new DesktopNotifier()
    this.soundNotifier = new SoundNotifier()
    this.config = {
      desktop: config.NOTIFICATIONS_DESKTOP,
      sound: config.NOTIFICATIONS_SOUND,
    }
  }

  /**
   * Update notification preferences
   */
  configure(options: { desktop?: boolean; sound?: boolean }): NotificationConfig {
    if (options.desktop !== undefined) {
      this.config.desktop = options.desktop
    }
    if (options.sound !== undefined) {
      this.config.sound = options.sound
    }
    return { ...this.config }
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config }
  }

  /**
   * Handle run status change event
   */
  async onRunStatusChange(runId: string, newStatus: RunStatus): Promise<void> {
    if (!this.config.desktop && !this.config.sound) {
      return
    }

    switch (newStatus) {
      case 'PASSED':
        if (this.config.desktop) {
          await this.desktopNotifier.notify({
            title: 'Run Passed',
            message: `Run ${runId} completed successfully`,
            icon: 'success',
          })
        }
        if (this.config.sound) {
          await this.soundNotifier.play('success')
        }
        break

      case 'FAILED':
        if (this.config.desktop) {
          await this.desktopNotifier.notify({
            title: 'Run Failed',
            message: `Run ${runId} failed`,
            icon: 'failure',
          })
        }
        if (this.config.sound) {
          await this.soundNotifier.play('failure')
        }
        break

      case 'RUNNING':
        if (this.config.sound) {
          await this.soundNotifier.play('started')
        }
        break
    }
  }
}

export { DesktopNotifier } from './DesktopNotifier.js'
export { SoundNotifier } from './SoundNotifier.js'
export type { INotifier, ISoundNotifier, NotificationOptions } from './INotifier.js'
