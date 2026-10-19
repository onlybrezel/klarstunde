import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DISPLAY_STORAGE_KEY, initialPlanSettings, readDisplayPreferences, resetDisplayPreferences, saveDisplayPreferences } from './navigation'

const storage = new Map<string, string>()
beforeEach(() => {
  storage.clear()
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } })
})
afterEach(() => vi.unstubAllGlobals())

describe('display preferences', () => {
  it('persists only explicitly allowed display values, never dates or added personal fields', () => {
    const settings = { date: '2000-01-01', view: 'day' as const, compact: true, effective: false, compare: true, email: 'private@example.invalid', pages: ['private'] }
    expect(saveDisplayPreferences(settings)).toBe(true)
    expect(JSON.parse(storage.get(DISPLAY_STORAGE_KEY)!)).toEqual({ version: 1, view: 'day', compact: true, effective: false, compare: true })
    expect(initialPlanSettings()).toMatchObject({ view: 'day', compact: true, compare: true })
    expect(initialPlanSettings().date).not.toBe('2000-01-01')
  })
  it.each([null, '{broken', 'null', '[]', '{"version":2,"view":"day"}'])('ignores invalid or unsupported storage: %s', (value) => {
    expect(readDisplayPreferences(value)).toEqual({})
  })
  it('ignores unknown fields and invalid types, and can reset preferences', () => {
    expect(readDisplayPreferences('{"version":1,"view":"unknown","compact":"true","compare":false,"date":"2000-01-01"}')).toEqual({ compare: false })
    saveDisplayPreferences({ ...initialPlanSettings(), compact: true })
    expect(resetDisplayPreferences()).toMatchObject({ settings: { compact: false }, removed: true })
    expect(storage.has(DISPLAY_STORAGE_KEY)).toBe(false)
  })
  it('remains usable when browser storage is blocked', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), get localStorage() { throw new Error('blocked') } })
    expect(initialPlanSettings().view).toBe('day')
    expect(saveDisplayPreferences(initialPlanSettings())).toBe(false)
    expect(resetDisplayPreferences()).toMatchObject({ settings: { compact: false }, removed: false })
  })
})
