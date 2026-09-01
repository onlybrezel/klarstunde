import { describe, expect, it, vi } from 'vitest'
import { SessionStore } from './session-store.js'

describe('SessionStore', () => {
  it('maps an opaque local token to the upstream session', () => {
    const store = new SessionStore(1_000)
    const token = store.create('upstream-id')
    expect(token).not.toContain('upstream-id')
    expect(store.get(token)).toBe('upstream-id')
  })

  it('drops expired sessions', () => {
    vi.useFakeTimers()
    const store = new SessionStore(100)
    const token = store.create('upstream-id')
    vi.advanceTimersByTime(101)
    expect(store.get(token)).toBeUndefined()
    vi.useRealTimers()
  })
})
