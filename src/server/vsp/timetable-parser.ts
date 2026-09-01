import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import type { Lesson } from '../../shared/timetable.js'

interface CellEntry {
  value: string
  previous?: string
  changed: boolean
  cancelled: boolean
  note?: string
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/^\+\s*/, '')
}

function entryFromHtml(html: string): CellEntry | undefined {
  const fragment = cheerio.load(`<div id="entry">${html}</div>`)
  const root = fragment('#entry')
  const deleted = normalize(root.find('del, s, strike').first().text())
  const emphasized = normalize(root.find('b, strong').first().text())
  const plainRoot = root.clone()
  plainRoot.find('del, s, strike, b, strong').remove()
  const plain = normalize(plainRoot.text()).replace(/^\((.*)\)$/, '$1')
  const fullText = normalize(root.text())
  if (!fullText || fullText === '-') return undefined

  const value = emphasized || (deleted && plain ? deleted : fullText)
  const previous = deleted || (emphasized && plain ? plain : '')
  return {
    value,
    ...(previous && previous !== value ? { previous } : {}),
    changed: Boolean(emphasized || deleted),
    cancelled: Boolean(deleted && !emphasized),
    ...(plain && deleted ? { note: plain } : {}),
  }
}

function cellEntries(cell: Element | undefined, $: cheerio.CheerioAPI): CellEntry[] {
  if (!cell) return []
  return ($(cell).html() ?? '')
    .split(/<br\s*\/?>/i)
    .map(entryFromHtml)
    .filter((entry): entry is CellEntry => Boolean(entry))
}

function readColumn($: cheerio.CheerioAPI, title: string): Map<number, CellEntry[]> {
  const rows = new Map<number, CellEntry[]>()
  $(`div[data-title="${title}"] #editableTable tr`).slice(1).each((_, row) => {
    const cells = $(row).find('td')
    const period = Number.parseInt(normalize(cells.eq(0).text()), 10)
    if (Number.isInteger(period) && period >= 0) rows.set(period, cellEntries(cells.get(1), $))
  })
  return rows
}

function at(rows: Map<number, CellEntry[]>, period: number, entry: number): CellEntry | undefined {
  return rows.get(period)?.[entry]
}

function previousValues(subject?: CellEntry, teacher?: CellEntry, room?: CellEntry): Lesson['previous'] | undefined {
  const previous = {
    ...(subject?.previous ? { subject: subject.previous } : {}),
    ...(teacher?.previous ? { teacher: teacher.previous } : {}),
    ...(room?.previous ? { room: room.previous } : {}),
  }
  return Object.keys(previous).length ? previous : undefined
}

export function parseTimetable(html: string): Lesson[] {
  const $ = cheerio.load(html)
  const subjects = readColumn($, 'Fach')
  const teachers = readColumn($, 'LK')
  const rooms = readColumn($, 'Raum')
  const exams = readColumn($, 'Klausur')
  const periods = [...new Set([...subjects.keys(), ...teachers.keys(), ...rooms.keys(), ...exams.keys()])].sort((a, b) => a - b)
  const lessons: Lesson[] = []

  for (const period of periods) {
    const entryCount = Math.max(subjects.get(period)?.length ?? 0, teachers.get(period)?.length ?? 0, rooms.get(period)?.length ?? 0, exams.get(period)?.length ?? 0)
    for (let entry = 0; entry < entryCount; entry += 1) {
      const subject = at(subjects, period, entry)
      const teacher = at(teachers, period, entry)
      const room = at(rooms, period, entry)
      const exam = at(exams, period, entry)
      if (!subject && !teacher && !room && !exam) continue

      const scheduleValues = [subject, teacher, room].filter((value): value is CellEntry => Boolean(value))
      const values = [...scheduleValues, exam].filter((value): value is CellEntry => Boolean(value))
      const notes = [...new Set(values.map((value) => value.note).filter((value): value is string => Boolean(value)))]
      const previous = previousValues(subject, teacher, room)
      const cancelled = Boolean(subject?.cancelled || scheduleValues.some((value) => value.note?.toLowerCase().includes('unterrichtsfrei')))

      lessons.push({
        period,
        subject: subject?.value ?? '',
        teacher: teacher?.value ?? '',
        room: room?.value ?? '',
        ...(exam?.value ? { exam: exam.value } : {}),
        ...(exam?.changed ? { examStatus: exam.cancelled ? 'cancelled' as const : 'changed' as const } : {}),
        ...(previous ? { previous } : {}),
        ...(notes.length ? { note: notes.join(' · ') } : {}),
        status: cancelled ? 'cancelled' : scheduleValues.some((value) => value.changed) ? 'changed' : 'regular',
      })
    }
  }
  return lessons
}
