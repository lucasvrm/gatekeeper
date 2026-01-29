/**
 * Unit tests for Notification System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationManager } from '../../src/notifications/index.js'
import type { Config } from '../../src/config.js'

function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    GATEKEEPER_API_URL: 'http://localhost:3000',
    DOCS_DIR: './docs',
    ARTIFACTS_DIR: './artifacts',
    NOTIFICATIONS_DESKTOP: true,
    NOTIFICATIONS_SOUND: true,
    ...overrides,
  }
}

describe('NotificationManager', () => {
  let manager: NotificationManager

  beforeEach(() => {
    manager = new NotificationManager(createMockConfig())
  })

  it('initializes with config values', () => {
    const config = manager.getConfig()

    expect(config.desktop).toBe(true)
    expect(config.sound).toBe(true)
  })

  it('configure updates notification preferences', () => {
    manager.configure({ desktop: false })
    const config = manager.getConfig()

    expect(config.desktop).toBe(false)
    expect(config.sound).toBe(true)
  })

  it('configure can update both preferences', () => {
    manager.configure({ desktop: false, sound: false })
    const config = manager.getConfig()

    expect(config.desktop).toBe(false)
    expect(config.sound).toBe(false)
  })

  it('initializes with disabled notifications when config says so', () => {
    const disabledManager = new NotificationManager(
      createMockConfig({
        NOTIFICATIONS_DESKTOP: false,
        NOTIFICATIONS_SOUND: false,
      })
    )

    const config = disabledManager.getConfig()
    expect(config.desktop).toBe(false)
    expect(config.sound).toBe(false)
  })
})

describe('NotificationManager.onRunStatusChange', () => {
  it('does not throw when notifications are disabled', async () => {
    const manager = new NotificationManager(
      createMockConfig({
        NOTIFICATIONS_DESKTOP: false,
        NOTIFICATIONS_SOUND: false,
      })
    )

    // Should not throw and return quickly (no-op)
    await expect(
      manager.onRunStatusChange('run_123', 'PASSED')
    ).resolves.not.toThrow()
  })

  it('returns immediately when both notifications are disabled', async () => {
    const manager = new NotificationManager(
      createMockConfig({
        NOTIFICATIONS_DESKTOP: false,
        NOTIFICATIONS_SOUND: false,
      })
    )

    // Should complete almost instantly since notifications are disabled
    const start = Date.now()
    await manager.onRunStatusChange('run_123', 'PASSED')
    await manager.onRunStatusChange('run_123', 'FAILED')
    await manager.onRunStatusChange('run_123', 'RUNNING')
    const elapsed = Date.now() - start

    // Should be very fast (under 100ms) since no actual notifications are sent
    expect(elapsed).toBeLessThan(100)
  })
})
