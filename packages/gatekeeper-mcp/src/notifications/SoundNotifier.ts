/**
 * Sound Notifier
 * Plays notification sounds using play-sound
 */

import * as path from 'path'
import { fileURLToPath } from 'url'
import type { ISoundNotifier } from './INotifier.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlayerType = any

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class SoundNotifier implements ISoundNotifier {
  private player: PlayerType = null
  private soundsDir: string

  constructor() {
    // Sound files are in assets/sounds/ relative to package root
    this.soundsDir = path.resolve(__dirname, '../../assets/sounds')
    this.loadPlayer()
  }

  private async loadPlayer(): Promise<void> {
    try {
      // @ts-expect-error play-sound has no types
      const playSound = await import('play-sound')
      const Player = playSound.default || playSound
      this.player = Player({})
    } catch {
      // play-sound not available
      this.player = null
    }
  }

  async play(sound: 'success' | 'failure' | 'started'): Promise<void> {
    if (!this.player) {
      await this.loadPlayer()
    }

    if (!this.player) {
      // Silently fail if play-sound is not available
      return
    }

    const soundFile = path.join(this.soundsDir, `${sound}.wav`)

    return new Promise((resolve) => {
      this.player.play(soundFile, () => {
        resolve()
      })
    })
  }
}
