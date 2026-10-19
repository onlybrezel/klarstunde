import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createSession, getSchoolArea, getTimetable, InvalidResponseError } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('browser API errors', () => {
  it('handles a malformed error body without exposing response contents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 502 })))
    await expect(getSchoolArea('attendance', '2026-10-19', '2026-10-20', {})).rejects.toBeInstanceOf(ApiError)
  })
  it('replaces invalid JSON with a readable error rather than quoting page contents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<p>private@example.invalid</p>')))
    const result = getSchoolArea('attendance', '2026-10-19', '2026-10-20', {})
    await expect(result).rejects.toBeInstanceOf(InvalidResponseError)
    await expect(result).rejects.toThrow('Die Antwort konnte nicht gelesen werden.')
  })
  it('offers a useful connection error without reporting a logout', async () => {
    const events = new EventTarget()
    const expired = vi.fn()
    events.addEventListener('session-expired', expired)
    vi.stubGlobal('window', events)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(getSchoolArea('attendance', '2026-10-19', '2026-10-20', {})).rejects.toThrow('Verbindung')
    expect(expired).not.toHaveBeenCalled()
  })

  it('requests reauthentication for expired data access, but not for incorrect login credentials', async () => {
    const events = new EventTarget()
    const expired = vi.fn()
    events.addEventListener('session-expired', expired)
    vi.stubGlobal('window', events)
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message: 'Bitte erneut anmelden.' }), { status: 401 })))
    await expect(createSession('beispiel@example.invalid', 'test-only')).rejects.toBeInstanceOf(ApiError)
    expect(expired).not.toHaveBeenCalled()
    await expect(getSchoolArea('attendance', '2026-10-19', '2026-10-20', {})).rejects.toBeInstanceOf(ApiError)
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('preserves cancellation rather than replacing it with a connection error', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = new DOMException('Cancelled', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
    await expect(getTimetable('2026-10-19', true, { view: 'day', effective: false, compare: false, signal: controller.signal })).rejects.toBe(error)
  })
})
