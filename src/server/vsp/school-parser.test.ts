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
    expect(parseStudentCard(html)).toEqual([{ title: 'Ausweis', text: 'Ausweis Name Beispiel', images: [{ alt: 'Photo', source: 'data:image/png;base64,abc', role: 'photo' }] }])
  })

  it('reads identity fields, school and status without flattening them into a paragraph', () => {
    const html = `<section class="page"><article>
      <div class="wallet-top"><span class="pill pill-light">BBS-ID</span><span class="pill pill-valid">GÜLTIG</span></div>
      <div class="wallet-main"><div class="photo-frame"><img alt="Photo" src="data:image/png;base64,cGhvdG8="></div>
      <div class="wallet-info"><div class="meta"><div class="meta-label">Name</div><div class="meta-value">Beispiel, Alex</div></div>
      <div class="meta"><div class="meta-label">Geburtsdatum</div><div class="meta-value">01.01.2008</div></div>
      <div class="meta"><div class="meta-label">Schuljahr - Klasse</div><div class="meta-value">2026/27 1.Halb</div></div></div></div>
      <div class="wallet-bottom">Beispiel, Alex ist Schüler*in an der: <strong>Beispielschule</strong></div>
    </article></section>`
    expect(parseStudentCard(html)[0]).toMatchObject({
      title: 'Schülerausweis', kind: 'identity', schoolName: 'Beispielschule', status: 'GÜLTIG',
      fields: [{ label: 'Name', value: 'Beispiel, Alex' }, { label: 'Geburtsdatum', value: '01.01.2008' }, { label: 'Schuljahr - Klasse', value: '2026/27 1.Halb' }],
      images: [{ alt: 'Photo', source: 'data:image/png;base64,cGhvdG8=', role: 'photo' }],
    })
    expect(parseStudentCard(html.replace('pill-valid', 'pill-expired').replace('GÜLTIG', 'ABGELAUFEN'))[0].status).toBe('ABGELAUFEN')
  })

  it('separates school address, verification QR and technical QR without changing the image bytes', () => {
    const html = `<section class="page"><article><span class="surface-pill">SCHULANSCHRIFT</span><div class="school-copy"><h2 class="school-title">Beispielschule</h2><div class="inline-row"><div class="inline-label">Adresse:</div><div class="inline-value">Schulstraße 1</div></div><div class="inline-row"><div class="inline-label">Ort:</div><div class="inline-value">12345 Beispielstadt</div></div></div></article></section>
      <section class="page"><article><span>Zum Überprüfen scannen</span><div class="qr-wrap"><img alt="BBS QR Code" src="data:image/png;base64,cXIrLz0="></div></article></section>
      <section class="page"><article><span>GUID QR</span><div class="qr-wrap"><img alt="GUID QR Code" src="data:image/png;base64,Z3VpZA=="></div></article></section>`
    const pages = parseStudentCard(html)
    expect(pages[0]).toMatchObject({ kind: 'school', schoolName: 'Beispielschule', fields: [{ label: 'Adresse', value: 'Schulstraße 1' }, { label: 'Ort', value: '12345 Beispielstadt' }] })
    expect(pages[1]).toMatchObject({ kind: 'verification', images: [{ source: 'data:image/png;base64,cXIrLz0=', role: 'code' }] })
    expect(pages[2]).toMatchObject({ kind: 'technical', images: [{ source: 'data:image/png;base64,Z3VpZA==', role: 'code' }] })
  })
})
