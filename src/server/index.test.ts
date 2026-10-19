import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app } from './index.js'
import { config } from './config.js'
import { fetchFiles, fetchSchoolArea, fetchStudentCard, fetchTimetable, login, SickNoteUncertainError, submitSickNote } from './vsp/client.js'

vi.mock('./vsp/client.js', async (original) => {
  const actual = await original<typeof import('./vsp/client.js')>()
  return { ...actual, login: vi.fn(), fetchTimetable: vi.fn(), submitSickNote: vi.fn(), fetchFiles: vi.fn(), fetchSchoolArea: vi.fn(), fetchStudentCard: vi.fn() }
})

let server: Server
let base: string
let cookie: string

beforeAll(async () => {
  config.autoLogin = undefined
  server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test port')
  base = `http://127.0.0.1:${address.port}`
  vi.mocked(login).mockResolvedValue('synthetic-session')
  const response = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'example@example.invalid', password: 'synthetic-test-value' }) })
  cookie = response.headers.get('set-cookie')!.split(';')[0]
})

afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) })

describe('local API validation and writes', () => {
  it('preserves explicit availability hints and the student-card response shape', async () => {
    const studentCard = { pages: [], availability: 'unavailable' as const }
    const files = { files: [], filters: [], availability: 'unavailable' as const }
    const area = { tables: [], notices: [], filters: [], availability: 'unavailable' as const }
    vi.mocked(fetchStudentCard).mockResolvedValue(studentCard)
    vi.mocked(fetchFiles).mockResolvedValue(files)
    vi.mocked(fetchSchoolArea).mockResolvedValue(area)
    for (const [route, expected] of [['student-card', studentCard], ['files', files], ['messages', area]] as const) {
      const response = await fetch(`${base}/api/${route}`, { headers: { cookie } })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }
  })
  it('rejects impossible and reversed dates before contacting the portal', async () => {
    const invalid = await fetch(`${base}/api/timetable?start=2026-02-30`, { headers: { cookie } })
    expect(invalid.status).toBe(400)
    expect(fetchTimetable).not.toHaveBeenCalled()
    for (const route of ['attendance', 'homework']) {
      const response = await fetch(`${base}/api/${route}?from=2026-10-28&until=2026-10-27`, { headers: { cookie } })
      expect(response.status).toBe(400)
    }
    const response = await fetch(`${base}/api/sick-notes`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ from: '2026-02-30', until: '2026-03-01' }) })
    expect(response.status).toBe(400)
    expect(submitSickNote).not.toHaveBeenCalled()
  })

  it('requires authentication and tells the browser not to persist school responses', async () => {
    const response = await fetch(`${base}/api/timetable?start=2026-10-27`)
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('normalizes week start and forwards view, effective and refresh choices', async () => {
    vi.mocked(fetchTimetable).mockResolvedValue({ days: [], source: 'live' })
    const response = await fetch(`${base}/api/timetable?start=2026-10-27&compare=1&effective=1&refresh=1`, { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(fetchTimetable).toHaveBeenLastCalledWith('synthetic-session', '2026-10-26', { count: 7, compare: true, effective: true }, true)
    await fetch(`${base}/api/timetable?start=2026-10-27&view=day`, { headers: { cookie } })
    expect(fetchTimetable).toHaveBeenLastCalledWith('synthetic-session', '2026-10-27', { count: 1, compare: false, effective: false }, false)
  })

  it('blocks a duplicate while sending and after an uncertain response', async () => {
    let finish: () => void = () => undefined
    let started: () => void = () => undefined
    const sending = new Promise<void>((resolve) => { started = resolve })
    vi.mocked(submitSickNote).mockImplementationOnce(() => {
      started()
      return new Promise<void>((_, reject) => { finish = () => reject(new SickNoteUncertainError('Bitte im Originalportal prüfen.')) })
    })
    const options = { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ from: '2026-10-27', until: '2026-10-28' }) }
    const first = fetch(`${base}/api/sick-notes`, options)
    await sending
    expect((await fetch(`${base}/api/sick-notes`, options)).status).toBe(409)
    finish()
    expect((await first).status).toBe(502)
    expect((await fetch(`${base}/api/sick-notes`, options)).status).toBe(409)
    expect(submitSickNote).toHaveBeenCalledTimes(1)
  })
})
