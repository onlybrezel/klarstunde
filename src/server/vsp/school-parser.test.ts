import { describe, expect, it } from 'vitest'
import { parseFilters, parseOptions, parseSharedFiles, parseStudentCard, parseTables } from './school-parser.js'

describe('school page parsers', () => {
  it('normalizes data tables', () => {
    const html = '<div data-title="Fehlzeiten"><table><thead><tr><th>Datum</th><th>Status</th></tr></thead><tbody><tr><th>01.09.</th><td>entschuldigt</td></tr></tbody></table></div>'
    expect(parseTables(html)).toEqual([{ title: 'Fehlzeiten', columns: ['Datum', 'Status'], rows: [['01.09.', 'entschuldigt']] }])
  })

  it('keeps file links in their table cells', () => {
    const html = '<table><tbody><tr><td>2026</td><td><a href="code-3/?id=example">Blockplan.pdf</a></td></tr></tbody></table>'
    expect(parseTables(html)).toEqual([{
      title: 'Übersicht 1',
      columns: [],
      rows: [['2026', 'Blockplan.pdf']],
      links: [[null, { label: 'Blockplan.pdf', href: 'code-3/?id=example' }]],
    }])
  })

  it('reads class options and shared files', () => {
    expect(parseOptions('<select name="Klasse"><option value="">- bitte auswählen -</option><option value="TEST1">TEST1</option></select>', 'Klasse')).toEqual([{ value: 'TEST1', label: 'TEST1' }])
    const files = '<table id="main-table"><tr><th>LF</th><th>Datei</th><th>Beschreibung</th></tr><tr><td>LF1</td><td><a href="docs/a.pdf">Aufgabe</a></td><td>Übung</td></tr></table>'
    expect(parseSharedFiles(files)).toEqual([{ area: 'LF1', name: 'Aufgabe', description: 'Übung', downloadHref: 'docs/a.pdf' }])
  })

  it('reads filters supplied by each school page', () => {
    const html = '<form><select name="Fach"><option value="">alle Fächer</option><option value="LF1">LF1</option></select><select name="Kurs"><option value="">alle Kurse</option></select></form>'
    expect(parseFilters(html)).toEqual([{ name: 'Fach', options: [{ value: '', label: 'alle Fächer' }, { value: 'LF1', label: 'LF1' }] }])
  })

  it('keeps student-card markup inert and returns only text and embedded images', () => {
    const html = '<section class="page"><article><h2>Ausweis</h2><script>alert(1)</script><p>Name Beispiel</p><img alt="Photo" src="data:image/png;base64,abc"></article></section>'
    expect(parseStudentCard(html)).toEqual([{ title: 'Ausweis', text: 'Ausweis Name Beispiel', images: [{ alt: 'Photo', source: 'data:image/png;base64,abc' }] }])
  })
})
