export function subjectLabel(code: string, labels: Record<string, string> = {}): string {
  const normalized = code.trim().toUpperCase()
  if (labels[normalized]) return labels[normalized]
  const learningField = normalized.match(/^LF\s*0?(\d{1,2})$/)
  return learningField ? `Lernfeld ${Number(learningField[1])}` : code
}

export function roomLabel(room: string, labels: Record<string, string> = {}): string {
  const configured = labels[room.trim().toUpperCase()]
  if (configured) return configured
  const match = room.match(/^([A-Z])(\d{3})$/i)
  if (!match) return room
  return `${match[1].toUpperCase()} ${match[2]}`
}

export function assessmentLabel(value: string): string {
  if (/klassenarbeit/i.test(value)) return 'Klassenarbeit'
  if (/leistungs(?:probe|überprüfung)/i.test(value)) return 'Leistungsprobe'
  if (/klausur/i.test(value)) return 'Klausur'
  if (/test/i.test(value)) return 'Test'
  return 'Prüfung'
}
