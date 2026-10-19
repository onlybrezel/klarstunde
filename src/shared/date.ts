export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function germanDate(value: unknown): string | undefined {
  if (!isIsoDate(value)) return undefined
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

export function fromGermanDate(value: string): string | undefined {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value)
  const iso = match && `${match[3]}-${match[2]}-${match[1]}`
  return isIsoDate(iso) ? iso : undefined
}

export function shiftDate(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function weekStart(value: string): string {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay()
  return shiftDate(value, -((day + 6) % 7))
}
