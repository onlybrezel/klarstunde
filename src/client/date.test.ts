import { describe, expect, it } from 'vitest'
import { semesterRange } from './date'

describe('Halbjahrauswahl', () => {
  it('includes the current January in the previous August semester', () => {
    expect(semesterRange(new Date(2026, 0, 15))).toEqual(['2025-08-01', '2026-01-31'])
    expect(semesterRange(new Date(2026, 1, 1))).toEqual(['2026-02-01', '2026-07-31'])
    expect(semesterRange(new Date(2026, 7, 1))).toEqual(['2026-08-01', '2027-01-31'])
  })
})
