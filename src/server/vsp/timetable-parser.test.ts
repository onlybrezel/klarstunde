import { describe, expect, it } from 'vitest'
import { ownClass, parseClassWeek, parseTimetable, parseTimetableDay, timetableDate } from './timetable-parser.js'

const table = (title: string, rows: string[]) => `
  <div data-title="${title}"><table id="editableTable"><tr><th>Stunde</th><th>${title}</th></tr>
  ${rows.map((value, index) => `<tr><td>${index + 1}</td><td>${value}</td></tr>`).join('')}
  </table></div>`

describe('parseTimetable', () => {
  it('combines subject, teacher and room by period', () => {
    const html = [
      table('Fach', ['Mathematik', 'Englisch']),
      table('LK', ['Kern', 'Berger']),
      table('Raum', ['B204', 'C018']),
    ].join('')

    expect(parseTimetable(html)).toEqual([
      { period: 1, subject: 'Mathematik', teacher: 'Kern', room: 'B204', status: 'regular' },
      { period: 2, subject: 'Englisch', teacher: 'Berger', room: 'C018', status: 'regular' },
    ])
  })

  it('keeps parallel lessons aligned and prefers changed bold values', () => {
    const html = [
      table('Fach', ['Mathematik<br>Physik', '<b>Englisch</b> Deutsch']),
      table('LK', ['Kern<br>Wolff', '<b>Berger</b> Brandt']),
      table('Raum', ['B204<br>D301', '<b>C018</b> A207']),
    ].join('')

    expect(parseTimetable(html)).toEqual([
      { period: 1, subject: 'Mathematik', teacher: 'Kern', room: 'B204', status: 'regular' },
      { period: 1, subject: 'Physik', teacher: 'Wolff', room: 'D301', status: 'regular' },
      { period: 2, subject: 'Englisch', teacher: 'Berger', room: 'C018', previous: { subject: 'Deutsch', teacher: 'Brandt', room: 'A207' }, status: 'changed' },
    ])
  })

  it('reads the actual period number and preserves room changes', () => {
    const html = [
      table('Fach', ['-', 'PO']),
      table('LK', ['-', 'KRM']),
      table('Raum', ['-', '<del>C102</del><b> + C319_PC_20</b>']),
    ].join('').replaceAll('<td>1</td>', '<td>0</td>').replaceAll('<td>2</td>', '<td>3</td>')

    expect(parseTimetable(html)).toEqual([
      { period: 3, subject: 'PO', teacher: 'KRM', room: 'C319_PC_20', previous: { room: 'C102' }, status: 'changed' },
    ])
  })

  it('recognizes a deleted lesson as cancelled', () => {
    const html = [
      table('Fach', ['<del>DE</del>']),
      table('LK', ['<del>HAT</del> (unterrichtsfrei)']),
      table('Raum', ['<del>C102</del>']),
    ].join('')

    expect(parseTimetable(html)).toEqual([
      { period: 1, subject: 'DE', teacher: 'HAT', room: 'C102', note: 'unterrichtsfrei', status: 'cancelled' },
    ])
  })

  it('keeps a cancelled assessment separate from the lesson status', () => {
    const html = [
      table('Fach', ['E']),
      table('LK', ['TST']),
      table('Raum', ['A101']),
      table('Klausur', ['<del>Klassenarbeit 1</del>']),
    ].join('')

    expect(parseTimetable(html)).toEqual([
      { period: 1, subject: 'E', teacher: 'TST', room: 'A101', exam: 'Klassenarbeit 1', examStatus: 'cancelled', status: 'regular' },
    ])
  })

  it('rejects missing or incomplete tables instead of claiming a free day', () => {
    expect(() => parseTimetable('<html><body>Login</body></html>')).toThrow('Aufbau')
    expect(() => parseTimetable(table('Fach', ['E']))).toThrow('Aufbau')
  })

  it('accepts explicitly empty lesson cells in a recognized plan', () => {
    expect(parseTimetable(['Fach', 'LK', 'Raum'].map((title) => table(title, ['-'])).join(''))).toEqual([])
  })

  it('keeps empty slots aligned between parallel courses', () => {
    const html = table('Fach', ['E<br>PO']) + table('LK', ['-<br>Kern']) + table('Raum', ['B204<br>-'])
    expect(parseTimetable(html)).toEqual([
      { period: 1, subject: 'E', teacher: '', room: 'B204', status: 'regular' },
      { period: 1, subject: 'PO', teacher: 'Kern', room: '', status: 'regular' },
    ])
  })

  it('represents repeated holiday values once without artificial teachers and rooms', () => {
    const html = ['Fach', 'LK', 'Raum'].map((title) => table(title, ['Herbstferien', 'Herbstferien'])).join('')
    expect(parseTimetableDay(html, '2026-10-19')).toEqual({ date: '2026-10-19', lessons: [], notice: 'Herbstferien' })
    const holiday = ['Fach', 'LK', 'Raum'].map((title) => table(title, ['Feiertag Beispiel', 'Feiertag Beispiel'])).join('')
    expect(parseTimetableDay(holiday, '2026-10-31')).toEqual({ date: '2026-10-31', lessons: [], notice: 'Feiertag Beispiel' })
  })

  it('reads a class week including period zero and Sunday from the correct columns', () => {
    const headers = ['26.10.', '27.10.', '28.10.', '29.10.', '30.10.', '31.10.', '01.11.']
    const html = ['Fach', 'LK', 'Raum'].map((title) => `<div data-title="${title}"><table id="editableTable"><tr><th>Std.</th>${headers.map((day) => `<th>${day}</th>`).join('')}</tr><tr><td>0</td>${headers.map((_, index) => `<td>${title}${index}</td>`).join('')}</tr></table></div>`).join('')
    const days = parseClassWeek(html, '2026-10-27')
    expect(days).toHaveLength(7)
    expect(days[0]).toEqual({ date: '2026-10-26', lessons: [{ period: 0, subject: 'Fach0', teacher: 'LK0', room: 'Raum0', status: 'regular' }] })
    expect(days[6].date).toBe('2026-11-01')
    expect(days[6].lessons[0].subject).toBe('Fach6')
    expect(() => parseClassWeek(html, '2026-11-02')).toThrow('Aufbau')
    expect(() => parseClassWeek(table('Fach', ['E']), '2026-10-27')).toThrow('Aufbau')
  })

  it('requires a valid source date and derives the own class from navigation only', () => {
    expect(timetableDate('<input name="KlaBuDatum" value="27.10.2026">')).toBe('2026-10-27')
    expect(() => timetableDate('<input name="KlaBuDatum" value="31.02.2026">')).toThrow('Aufbau')
    expect(ownClass('<a href="./page-17/index.php?Klasse=TEST1">Unterrichtswoche +</a>')).toBe('TEST1')
    expect(ownClass('<p>Klasse TEST1</p>')).toBeUndefined()
  })
})
