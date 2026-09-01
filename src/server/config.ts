function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, positiveNumber(value, fallback)))
}

function labelMap(value: string | undefined): Record<string, string> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed)
      .filter(([key, label]) => key.length <= 40 && typeof label === 'string' && label.trim() && label.length <= 100)
      .slice(0, 200)
      .map(([key, label]) => [key.trim().toUpperCase(), (label as string).trim()]))
  } catch {
    return {}
  }
}

export const config = {
  port: positiveNumber(process.env.PORT, 4173),
  host: process.env.HOST ?? '127.0.0.1',
  upstreamBaseUrl: process.env.VSP_BASE_URL ?? 'https://virtueller-stundenplan.org',
  sessionTtlMs: positiveNumber(process.env.SESSION_TTL_HOURS, 8) * 60 * 60 * 1000,
  previewPassword: process.env.PREVIEW_PASSWORD,
  secureCookies: process.env.COOKIE_SECURE === 'true',
  autoLogin: process.env.VSP_AUTO_LOGIN_EMAIL && process.env.VSP_AUTO_LOGIN_PASSWORD
    ? { email: process.env.VSP_AUTO_LOGIN_EMAIL, password: process.env.VSP_AUTO_LOGIN_PASSWORD }
    : undefined,
  timetableWatch: {
    enabled: process.env.TIMETABLE_WATCH_ENABLED === 'true',
    intervalMinutes: boundedNumber(process.env.TIMETABLE_WATCH_INTERVAL_MINUTES, 15, 5, 180),
    days: boundedNumber(process.env.TIMETABLE_WATCH_DAYS, 14, 1, 28),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
  },
  labels: {
    subjects: labelMap(process.env.VSP_SUBJECT_LABELS),
    rooms: labelMap(process.env.VSP_ROOM_LABELS),
  },
}
