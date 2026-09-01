import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../shared/timetable.js'
import { changedDates, formatChanges } from './schedule-watch.js'

function lesson(subject: string, room = 'A 101'): Lesson {
  return { period: 1, subject, teacher: 'Frau Test', room, status: 'regular' }
}

describe('Stundenplanänderungen', () => {
  it('findet Änderungen an bereits bekannten Tagen', () => {
    const previous = { '2026-09-02': [lesson('Deutsch')] }
    const current = { '2026-09-02': [lesson('Mathematik')] }
    expect(changedDates(previous, current)).toEqual(['2026-09-02'])
  })

  it('meldet neu hinzugekommene zukünftige Tage nicht als Änderung', () => {
    const previous = { '2026-09-02': [lesson('Deutsch')] }
    const current = { ...previous, '2026-09-03': [lesson('Englisch')] }
    expect(changedDates(previous, current)).toEqual([])
  })

  it('beschreibt die geänderte Stunde knapp', () => {
    const previous = { '2026-09-02': [lesson('Deutsch')] }
    const current = { '2026-09-02': [lesson('Mathematik', 'B 204')] }
    const message = formatChanges(previous, current, ['2026-09-02'])
    expect(message).toContain('1. Stunde: Deutsch · A 101 · Frau Test → Mathematik · B 204 · Frau Test')
  })
})
