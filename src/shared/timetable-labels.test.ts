import { describe, expect, it } from 'vitest'
import { assessmentLabel, roomLabel, subjectLabel } from './timetable-labels.js'

describe('Stundenplanbezeichnungen', () => {
  it('ordnet bekannte Fachkürzel ein, ohne unbekannte zu erfinden', () => {
    expect(subjectLabel('PO')).toBe('PO')
    expect(subjectLabel('PO', { PO: 'Politik' })).toBe('Politik')
    expect(subjectLabel('LF05')).toBe('Lernfeld 5')
    expect(subjectLabel('XY42')).toBe('XY42')
  })

  it('macht Raumkürzel lesbarer', () => {
    expect(roomLabel('A101')).toBe('A 101')
    expect(roomLabel('A101_PC_24')).toBe('A101_PC_24')
    expect(roomLabel('A101_PC_24', { A101_PC_24: 'A 101 · PC-Raum' })).toBe('A 101 · PC-Raum')
    expect(roomLabel('NAUM')).toBe('NAUM')
  })

  it('unterscheidet Arten von Leistungsnachweisen', () => {
    expect(assessmentLabel('Klassenarbeit 1')).toBe('Klassenarbeit')
    expect(assessmentLabel('Leistungsprobe')).toBe('Leistungsprobe')
    expect(assessmentLabel('Klausur')).toBe('Klausur')
  })
})
