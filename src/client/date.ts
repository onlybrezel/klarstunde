export function mondayOf(date: Date): Date {
  const result = new Date(date)
  result.setHours(12, 0, 0, 0)
  const distance = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - distance)
  return result
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekLabel(monday: Date): string {
  const friday = addDays(monday, 6)
  const start = monday.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
  const end = friday.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${start} – ${end}`
}

export function semesterRange(today: Date): [string, string] {
  const year = today.getFullYear()
  if (today.getMonth() === 0) return [`${year - 1}-08-01`, `${year}-01-31`]
  return today.getMonth() < 7
    ? [`${year}-02-01`, `${year}-07-31`]
    : [`${year}-08-01`, `${year + 1}-01-31`]
}
