import { describe, expect, it } from 'vitest'
import { parseTimetable } from './timetable-parser.js'

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

  it('returns an empty plan when the expected tables are missing', () => {
    expect(parseTimetable('<html><body>Login</body></html>')).toEqual([])
  })
})
