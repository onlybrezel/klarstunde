import { describe, expect, it } from 'vitest'
import { fromGermanDate, germanDate, isIsoDate, shiftDate, weekStart } from './date.js'

describe('calendar dates', () => {
  it('rejects impossible dates and accepts leap days only in leap years', () => {
    for (const value of ['', '2026-02-29', '2026-04-31', '2026-13-01', '2026-1-02', null]) expect(isIsoDate(value)).toBe(false)
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(germanDate('2026-02-30')).toBeUndefined()
    expect(fromGermanDate('31.02.2026')).toBeUndefined()
    expect(fromGermanDate('27.10.2026')).toBe('2026-10-27')
  })

  it('crosses year and DST boundaries without shifting calendar days', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDate('2026-03-29', -1)).toBe('2026-03-28')
    expect(weekStart('2026-11-01')).toBe('2026-10-26')
    expect(germanDate('2026-10-27')).toBe('27.10.2026')
  })
})
