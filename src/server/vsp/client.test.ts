import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearTimetableCache, fetchSchoolArea, fetchStudentCard, fetchTeachingDate, fetchTimetable, SickNoteUncertainError, submitSickNote, UpstreamSessionExpiredError } from './client.js'

function page(date = '27.10.2026', extra = ''): string {
  return `<input name="KlaBuDatum" value="${date}">${extra}` + ['Fach', 'LK', 'Raum'].map((title) => `<div data-title="${title}"><table id="editableTable"><tr><th>Std.</th><th>Plan</th></tr><tr><td>0</td><td>-</td></tr><tr><td>1</td><td>${title}</td></tr></table></div>`).join('')
}

afterEach(() => { clearTimetableCache('test-session'); clearTimetableCache('other-session'); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('timetable access', () => {
  it.each([
    () => new Response(null, { status: 302, headers: { location: '/' } }),
    () => new Response('Anmeldung erforderlich', { status: 401 }),
    () => new Response('<form><input name="MAIL"><input name="SCHUELERCODE" type="password"></form>'),
  ])('recognizes expired sessions before parsing a login page as empty school data', async (response) => {
    const fetchMock = vi.fn().mockImplementation(async () => response())
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchSchoolArea('test-session', '/page2/page-2/')).rejects.toBeInstanceOf(UpstreamSessionExpiredError)
    await expect(fetchStudentCard('test-session')).rejects.toBeInstanceOf(UpstreamSessionExpiredError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('recovers after an incomplete source table without retaining a failed cache entry', async () => {
    const incomplete = page().replace(/<div data-title="Raum">[\s\S]*?<\/div>/, '')
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(incomplete)).mockResolvedValueOnce(new Response(page()))
    vi.stubGlobal('fetch', fetchMock)
    const options = { count: 1 as const, effective: false, compare: false }
    await expect(fetchTimetable('test-session', '2026-10-27', options)).rejects.toThrow('Aufbau')
    await expect(fetchTimetable('test-session', '2026-10-27', options)).resolves.toMatchObject({ days: [{ date: '2026-10-27' }] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares concurrent identical reads, caches briefly and bypasses cache on refresh', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(page()))
    vi.stubGlobal('fetch', fetchMock)
    const options = { count: 1 as const, effective: false, compare: false }
    const first = fetchTimetable('test-session', '2026-10-27', options)
    const second = fetchTimetable('test-session', '2026-10-27', options)
    expect(await first).toEqual(await second)
    await fetchTimetable('test-session', '2026-10-27', options)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await fetchTimetable('test-session', '2026-10-27', options, true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    clearTimetableCache('test-session')
    await fetchTimetable('test-session', '2026-10-27', options)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not cache parser errors or dates belonging to a different day', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('Login')).mockResolvedValueOnce(new Response(page('28.10.2026'))).mockResolvedValueOnce(new Response(page()))
    vi.stubGlobal('fetch', fetchMock)
    const options = { count: 1 as const, effective: true, compare: false }
    await expect(fetchTimetable('test-session', '2026-10-27', options)).rejects.toThrow('Aufbau')
    await expect(fetchTimetable('test-session', '2026-10-27', options)).rejects.toThrow('anderen Tag')
    await expect(fetchTimetable('test-session', '2026-10-27', options)).resolves.toMatchObject({ source: 'live' })
    const url = fetchMock.mock.calls[2][0] as URL
    expect(url.searchParams.get('HideChanges')).toBe('1')
    expect(url.searchParams.has('HideChangesOff')).toBe(false)
    expect(url.searchParams.get('CompactOff')).toBe('1')
  })

  it('expires cached results and never shares them between sessions', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockImplementation(async () => new Response(page()))
    vi.stubGlobal('fetch', fetchMock)
    const options = { count: 1 as const, effective: false, compare: false }
    await fetchTimetable('test-session', '2026-10-27', options)
    await fetchTimetable('other-session', '2026-10-27', options)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.setSystemTime(Date.now() + 30_001)
    await fetchTimetable('test-session', '2026-10-27', options)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('loads all seven days sequentially even when two views are requested concurrently', async () => {
    let active = 0
    let maximum = 0
    const fetchMock = vi.fn().mockImplementation(async (url: URL) => {
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active -= 1
      return new Response(page(url.searchParams.get('KlaBuDatum')!))
    })
    vi.stubGlobal('fetch', fetchMock)
    const week = fetchTimetable('test-session', '2026-10-26', { count: 7, effective: false, compare: false })
    const day = fetchTimetable('test-session', '2026-10-27', { count: 1, effective: false, compare: false })
    expect((await week).days.map((entry) => entry.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect((await day).days.map((entry) => entry.date)).toEqual(['2026-10-27'])
    expect(maximum).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(7)
  })

  it('reuses the personal plan when enabling comparison and fetches the class week once', async () => {
    const headers = ['26.10.', '27.10.', '28.10.', '29.10.', '30.10.', '31.10.', '01.11.']
    const classHtml = ['Fach', 'LK', 'Raum'].map((title) => `<div data-title="${title}"><table id="editableTable"><tr><th>Std.</th>${headers.map((day) => `<th>${day}</th>`).join('')}</tr><tr><td>1</td>${headers.map(() => `<td>${title}</td>`).join('')}</tr></table></div>`).join('')
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(page('27.10.2026', '<a href="./page-17/index.php?Klasse=TEST1">Unterrichtswoche +</a>'))).mockResolvedValueOnce(new Response(classHtml))
    vi.stubGlobal('fetch', fetchMock)
    const options = { count: 1 as const, effective: false, compare: false }
    await fetchTimetable('test-session', '2026-10-27', options)
    const result = await fetchTimetable('test-session', '2026-10-27', { ...options, compare: true })
    expect(result.className).toBe('TEST1')
    expect(result.classDays).toHaveLength(7)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((fetchMock.mock.calls[1][0] as URL).searchParams.get('Klasse')).toBe('TEST1')
  })

  it('follows only the supplied teaching-week navigation and validates its resulting date', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(page('19.10.2026', '<a href="./page-17/index.php?Klasse=TEST1">Unterrichtswoche +</a>')))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/page2/index.php?KlaBuDatum=27.10.2026' } }))
      .mockResolvedValueOnce(new Response(page()))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchTeachingDate('test-session', '2026-10-19', 'next')).toBe('2026-10-27')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/page2/page-17/index.php?Klasse=TEST1')
  })

  it('refuses foreign navigation links without sending the session to them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(page('19.10.2026', '<a href="https://example.invalid/page2/page-17/index.php">Unterrichtswoche +</a>')))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchTeachingDate('test-session', '2026-10-19', 'next')).rejects.toThrow('geändert')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never claims an unverified sick-note response as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<p>Unbekannte Antwort</p>')))
    await expect(submitSickNote('test-session', '27.10.2026', '28.10.2026')).rejects.toBeInstanceOf(SickNoteUncertainError)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    await expect(submitSickNote('test-session', '27.10.2026', '28.10.2026')).rejects.toBeInstanceOf(SickNoteUncertainError)
  })
})
