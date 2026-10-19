import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import type { Lesson, TimetableDay } from '../../shared/timetable.js'
import { fromGermanDate, shiftDate, weekStart } from '../../shared/date.js'

export class TimetableParseError extends Error {
  constructor() { super('Der Aufbau des Stundenplans wurde nicht erkannt. Bitte prüfe den Plan im Originalportal.') }
}

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

function cellEntries(cell: Element | undefined, $: cheerio.CheerioAPI): Array<CellEntry | undefined> {
  if (!cell) return []
  return ($(cell).html() ?? '')
    .split(/<br\s*\/?>/i)
    .map(entryFromHtml)
}

function readColumn($: cheerio.CheerioAPI, title: string, column: number): Map<number, Array<CellEntry | undefined>> {
  const rows = new Map<number, Array<CellEntry | undefined>>()
  $(`div[data-title="${title}"] #editableTable tr`).slice(1).each((_, row) => {
    const cells = $(row).find('td')
    const value = normalize(cells.eq(0).text())
    const period = /^\d+$/.test(value) ? Number(value) : NaN
    if (Number.isInteger(period) && period >= 0) rows.set(period, cellEntries(cells.get(column), $))
  })
  return rows
}

function at(rows: Map<number, Array<CellEntry | undefined>>, period: number, entry: number): CellEntry | undefined {
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

export function parseTimetable(html: string, column = 1): Lesson[] {
  const $ = cheerio.load(html)
  for (const title of ['Fach', 'LK', 'Raum']) {
    const table = $(`div[data-title="${title}"] #editableTable`)
    if (table.length !== 1 || table.find('tr').first().children().length <= column) throw new TimetableParseError()
  }
  const subjects = readColumn($, 'Fach', column)
  const teachers = readColumn($, 'LK', column)
  const rooms = readColumn($, 'Raum', column)
  const exams = readColumn($, 'Klausur', column)
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

export function parseTimetableDay(html: string, date: string, column = 1): TimetableDay {
  const lessons = parseTimetable(html, column)
  const first = lessons[0]
  const repeatedDayText = first && lessons.length > 1 && lessons.every((lesson) => lesson.teacher === first.subject && lesson.room === first.subject)
  if (first && (/(?:ferien$|^unterrichtsfrei$)/i.test(first.subject) || repeatedDayText)
    && lessons.every((lesson) => lesson.subject === first.subject && lesson.status === 'regular' && !lesson.exam
      && (!lesson.teacher || lesson.teacher === first.subject) && (!lesson.room || lesson.room === first.subject))) {
    return { date, lessons: [], notice: first.subject }
  }
  return { date, lessons }
}

export function parseClassWeek(html: string, start: string): TimetableDay[] {
  const $ = cheerio.load(html)
  const headers = $('div[data-title="Fach"] #editableTable tr').first().children().slice(1).toArray()
  if (headers.length !== 7) throw new TimetableParseError()
  const monday = weekStart(start)
  return headers.map((header, index) => {
    const date = shiftDate(monday, index)
    const [, month, day] = date.split('-')
    if (!$(header).text().replace(/\s+/g, '').endsWith(`${day}.${month}.`)) throw new TimetableParseError()
    return parseTimetableDay(html, date, index + 1)
  })
}

export function timetableDate(html: string): string {
  const $ = cheerio.load(html)
  const value = $('input[name="KlaBuDatum"]').attr('value') ?? ''
  const date = fromGermanDate(value)
  if (!date) throw new TimetableParseError()
  return date
}

export function ownClass(html: string): string | undefined {
  const $ = cheerio.load(html)
  const href = $('a[href]').filter((_, link) => $(link).text().trim() === 'Unterrichtswoche +').first().attr('href')
  const value = href && new URL(href, 'https://example.invalid/page2/').searchParams.get('Klasse')
  return value && value.length <= 80 ? value : undefined
}
