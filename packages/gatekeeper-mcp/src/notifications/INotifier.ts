/**
 * Notifier Interface
 * Defines the contract for notification implementations
 */

export interface NotificationOptions {
  title: string
  message: string
  icon?: 'success' | 'failure' | 'info'
}

export interface INotifier {
  notify(options: NotificationOptions): Promise<void>
}

export interface ISoundNotifier {
  play(sound: 'success' | 'failure' | 'started'): Promise<void>
}
