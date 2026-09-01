export interface NotificationStatus {
  configured: boolean
  running: boolean
  channel: 'Telegram'
  intervalMinutes: number
  watchedDays: number
  lastCheckedAt?: string
  lastNotificationAt?: string
  waitingForConfirmation: boolean
  message?: string
}
