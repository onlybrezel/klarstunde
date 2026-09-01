import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Lesson } from '../../shared/timetable.js'
import type { NotificationStatus } from '../../shared/notifications.js'
import { fetchTimetableDay, login } from '../vsp/client.js'
import { sendTelegramMessage } from './telegram.js'

type Snapshot = Record<string, Lesson[]>

interface PersistedWatchState {
  confirmed: Snapshot
  candidate?: { signature: string; snapshot: Snapshot }
  lastCheckedAt?: string
  lastNotificationAt?: string
}

interface WatchConfig {
  enabled: boolean
  intervalMinutes: number
  days: number
  botToken?: string
  chatId?: string
  account?: { email: string; password: string }
  stateFile?: string
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function germanDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(date)
}

function signature(snapshot: Snapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

export function changedDates(previous: Snapshot, current: Snapshot): string[] {
  return Object.keys(current).filter((date) => previous[date] && JSON.stringify(previous[date]) !== JSON.stringify(current[date]))
}

function describeLesson(lesson: Lesson | undefined): string {
  if (!lesson) return 'frei'
  const details = [lesson.subject || 'Unterricht', lesson.room, lesson.teacher, lesson.exam].filter(Boolean).join(' · ')
  return lesson.status === 'cancelled' ? `${details} (entfällt)` : details
}

function describePeriod(lessons: Lesson[]): string {
  return lessons.length ? lessons.map(describeLesson).join(' / ') : 'frei'
}

export function formatChanges(previous: Snapshot, current: Snapshot, dates: string[]): string {
  const lines = ['📅 Stundenplan geändert', '']
  for (const date of dates) {
    const oldLessons = previous[date] ?? []
    const newLessons = current[date] ?? []
    const periods = [...new Set([...oldLessons, ...newLessons].map((lesson) => lesson.period))].sort((a, b) => a - b)
    const changedPeriods = periods.filter((period) => JSON.stringify(oldLessons.filter((lesson) => lesson.period === period)) !== JSON.stringify(newLessons.filter((lesson) => lesson.period === period)))
    lines.push(new Date(`${date}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' }))
    for (const period of changedPeriods.slice(0, 6)) {
      const before = oldLessons.filter((lesson) => lesson.period === period)
      const after = newLessons.filter((lesson) => lesson.period === period)
      lines.push(`${period}. Stunde: ${describePeriod(before)} → ${describePeriod(after)}`)
    }
    lines.push('')
  }
  lines.push('Öffne Klarstunde für den vollständigen Plan.')
  return lines.join('\n')
}

async function loadState(file: string): Promise<PersistedWatchState> {
  try { return JSON.parse(await readFile(file, 'utf8')) as PersistedWatchState } catch { return { confirmed: {} } }
}

async function saveState(file: string, state: PersistedWatchState): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
  await rename(temporary, file)
}

export class ScheduleWatch {
  private readonly stateFile: string
  private state: PersistedWatchState = { confirmed: {} }
  private timer?: NodeJS.Timeout
  private checking = false

  constructor(private readonly config: WatchConfig) {
    this.stateFile = config.stateFile ?? path.resolve('.data/timetable-watch.json')
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) return
    this.state = await loadState(this.stateFile)
    await this.check().catch((error: unknown) => console.error('Stundenplan-Prüfung fehlgeschlagen:', error instanceof Error ? error.message : error))
    this.timer = setInterval(() => void this.check().catch((error: unknown) => console.error('Stundenplan-Prüfung fehlgeschlagen:', error instanceof Error ? error.message : error)), this.config.intervalMinutes * 60_000)
    this.timer.unref()
  }

  status(): NotificationStatus {
    const configured = this.isConfigured()
    return {
      configured,
      running: Boolean(this.timer),
      channel: 'Telegram',
      intervalMinutes: this.config.intervalMinutes,
      watchedDays: this.config.days,
      lastCheckedAt: this.state.lastCheckedAt,
      lastNotificationAt: this.state.lastNotificationAt,
      waitingForConfirmation: Boolean(this.state.candidate),
      ...(!configured ? { message: this.configurationMessage() } : {}),
    }
  }

  async sendTest(): Promise<void> {
    if (!this.isConfigured()) throw new Error('Telegram ist noch nicht vollständig eingerichtet.')
    await sendTelegramMessage(this.config.botToken!, this.config.chatId!, '✅ Klarstunde ist verbunden. Du erhältst hier künftig bestätigte Stundenplanänderungen.')
  }

  async check(): Promise<void> {
    if (!this.isConfigured() || this.checking) return
    this.checking = true
    try {
      const upstreamSessionId = await login(this.config.account!.email, this.config.account!.password)
      if (!upstreamSessionId) throw new Error('Automatische Anmeldung fehlgeschlagen.')
      const current: Snapshot = {}
      const start = new Date()
      start.setHours(12, 0, 0, 0)
      for (let offset = 0; offset < this.config.days; offset += 1) {
        const date = new Date(start)
        date.setDate(start.getDate() + offset)
        if (date.getDay() === 0 || date.getDay() === 6) continue
        const key = isoDate(date)
        current[key] = (await fetchTimetableDay(upstreamSessionId, germanDate(date))).lessons
      }

      const totalPrevious = Object.values(this.state.confirmed).reduce((sum, lessons) => sum + lessons.length, 0)
      const totalCurrent = Object.values(current).reduce((sum, lessons) => sum + lessons.length, 0)
      if (totalPrevious > 0 && totalCurrent === 0) throw new Error('Der neue Abruf enthält keine Stunden und wird nicht übernommen.')

      const dates = changedDates(this.state.confirmed, current)
      if (Object.keys(this.state.confirmed).length === 0 || dates.length === 0) {
        this.state.confirmed = current
        this.state.candidate = undefined
      } else {
        const currentSignature = signature(current)
        if (this.state.candidate?.signature === currentSignature) {
          await sendTelegramMessage(this.config.botToken!, this.config.chatId!, formatChanges(this.state.confirmed, current, dates))
          this.state.confirmed = current
          this.state.candidate = undefined
          this.state.lastNotificationAt = new Date().toISOString()
        } else {
          this.state.candidate = { signature: currentSignature, snapshot: current }
        }
      }
      this.state.lastCheckedAt = new Date().toISOString()
      await saveState(this.stateFile, this.state)
    } finally {
      this.checking = false
    }
  }

  private isConfigured(): boolean {
    return Boolean(this.config.enabled && this.config.botToken && this.config.chatId && this.config.account)
  }

  private configurationMessage(): string {
    if (!this.config.account) return 'Für die Prüfung fehlt noch ein fest hinterlegtes Schulkonto.'
    if (!this.config.botToken || !this.config.chatId) return 'Telegram ist noch nicht vollständig eingerichtet.'
    return 'Die automatische Prüfung ist noch nicht aktiviert.'
  }
}
