import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { timingSafeEqual } from 'node:crypto'
import express from 'express'
import './load-env.js'
import { config } from './config.js'
import { clearSessionCookie, LOCAL_SESSION_COOKIE, readCookie, setSessionCookie } from './http-cookies.js'
import { SessionStore } from './session-store.js'
import { demoWeek } from './demo-data.js'
import { ScheduleWatch } from './notifications/schedule-watch.js'
import { clearTimetableCache, fetchClasses, fetchFiles, fetchSchoolArea, fetchSharedFile, fetchStudentCard, fetchTimetable, fetchTeachingDate, fetchClassWeek, login, submitSickNote, SickNoteUncertainError, UpstreamSessionExpiredError, UpstreamUnavailableError } from './vsp/client.js'
import { TimetableParseError } from './vsp/timetable-parser.js'
import { germanDate, isIsoDate, weekStart } from '../shared/date.js'

const app = express()
const sessions = new SessionStore(config.sessionTtlMs)
const scheduleWatch = new ScheduleWatch({
  enabled: config.timetableWatch.enabled,
  intervalMinutes: config.timetableWatch.intervalMinutes,
  days: config.timetableWatch.days,
  botToken: config.timetableWatch.telegramBotToken,
  chatId: config.timetableWatch.telegramChatId,
  account: config.autoLogin,
})
let automaticLogin: Promise<string | undefined> | undefined

app.disable('x-powered-by')
app.use(express.json({ limit: '20kb' }))
app.use('/api', (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

if (config.previewPassword) {
  app.use((request, response, next) => {
    const expected = Buffer.from(`preview:${config.previewPassword}`).toString('base64')
    const received = request.headers.authorization?.replace(/^Basic\s+/i, '') ?? ''
    const matches = received.length === expected.length
      && timingSafeEqual(Buffer.from(received), Buffer.from(expected))
    if (matches) {
      next()
      return
    }
    response.setHeader('WWW-Authenticate', 'Basic realm="Klarstunde Vorschau", charset="UTF-8"')
    response.status(401).send('Zugangsdaten für die Vorschau fehlen.')
  })
}

app.get('/api/session', async (request, response) => {
  const existingSession = sessions.get(readCookie(request, LOCAL_SESSION_COOKIE))
  if (existingSession || !config.autoLogin) {
    response.json({ authenticated: Boolean(existingSession), automatic: false })
    return
  }

  try {
    automaticLogin ??= login(config.autoLogin.email, config.autoLogin.password).finally(() => { automaticLogin = undefined })
    const upstreamSessionId = await automaticLogin
    if (!upstreamSessionId) {
      response.json({ authenticated: false, automatic: false })
      return
    }
    setSessionCookie(response, sessions.create(upstreamSessionId), config.sessionTtlMs, config.secureCookies)
    response.json({ authenticated: true, automatic: true })
  } catch {
    response.json({ authenticated: false, automatic: false })
  }
})

app.post('/api/session', async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  if (!email || !password || email.length > 254 || password.length > 512) {
    response.status(400).json({ message: 'E-Mail-Adresse und Passwort fehlen.' })
    return
  }

  try {
    const upstreamSessionId = await login(email, password)
    if (!upstreamSessionId) {
      response.status(401).json({ message: 'E-Mail-Adresse oder Passwort stimmt nicht.' })
      return
    }
    setSessionCookie(response, sessions.create(upstreamSessionId), config.sessionTtlMs, config.secureCookies)
    response.status(204).end()
  } catch (error) {
    const message = error instanceof UpstreamUnavailableError ? error.message : 'Der Stundenplan ist gerade nicht erreichbar.'
    response.status(error instanceof UpstreamSessionExpiredError ? 401 : 502).json({ message })
  }
})

app.delete('/api/session', (request, response) => {
  const session = sessions.get(readCookie(request, LOCAL_SESSION_COOKIE))
  if (session) clearTimetableCache(session)
  sessions.delete(readCookie(request, LOCAL_SESSION_COOKIE))
  clearSessionCookie(response)
  response.status(204).end()
})

app.get('/api/timetable', async (request, response) => {
  const start = typeof request.query.start === 'string' ? request.query.start : ''
  const demo = request.query.demo === '1'
  if (!isIsoDate(start)) {
    response.status(400).json({ message: 'Das Startdatum ist ungültig.' })
    return
  }
  if (demo) {
    const days = demoWeek(weekStart(start))
    response.json({ days: request.query.view === 'day' ? days.filter((day) => day.date === start) : days, source: 'demo', labels: config.labels, fetchedAt: new Date().toISOString(), ...(request.query.compare === '1' ? { className: 'Beispielklasse', classDays: days } : {}) })
    return
  }

  const upstreamSessionId = sessions.get(readCookie(request, LOCAL_SESSION_COOKIE))
  if (!upstreamSessionId) {
    response.status(401).json({ message: 'Bitte melde dich erneut an.' })
    return
  }

  try {
    const daily = request.query.view === 'day'
    const result = await fetchTimetable(upstreamSessionId, daily ? start : weekStart(start), {
      count: daily ? 1 : 7, effective: request.query.effective === '1', compare: request.query.compare === '1',
    }, request.query.refresh === '1')
    response.json({ ...result, labels: config.labels })
  } catch (error) {
    const message = error instanceof UpstreamUnavailableError || error instanceof TimetableParseError ? error.message : 'Der Stundenplan konnte nicht geladen werden.'
    response.status(error instanceof UpstreamSessionExpiredError ? 401 : 502).json({ message })
  }
})

function authenticatedSession(request: express.Request, response: express.Response): string | undefined {
  const session = sessions.get(readCookie(request, LOCAL_SESSION_COOKIE))
  if (!session) response.status(401).json({ message: 'Bitte melde dich erneut an.' })
  return session
}

function areaError(response: express.Response, error: unknown): void {
  const message = error instanceof UpstreamUnavailableError || error instanceof TimetableParseError ? error.message : 'Der Bereich konnte nicht geladen werden.'
  response.status(error instanceof UpstreamSessionExpiredError ? 401 : 502).json({ message })
}

app.get('/api/timetable/teaching-date', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const start = request.query.start
  const direction = request.query.direction
  if (!isIsoDate(start) || (direction !== 'previous' && direction !== 'next')) return void response.status(400).json({ message: 'Datum oder Richtung ist ungültig.' })
  try { response.json({ date: await fetchTeachingDate(session, start, direction) }) } catch (error) { areaError(response, error) }
})

function selectedFilters(request: express.Request, names: readonly string[]): URLSearchParams {
  const parameters = new URLSearchParams()
  for (const name of names) {
    const value = request.query[name]
    if (typeof value === 'string' && value.length <= 100) parameters.set(name, value)
  }
  return parameters
}

app.get('/api/notifications/status', (request, response) => {
  if (!authenticatedSession(request, response)) return
  response.json(scheduleWatch.status())
})

app.post('/api/notifications/test', async (request, response) => {
  if (!authenticatedSession(request, response)) return
  try {
    await scheduleWatch.sendTest()
    response.status(204).end()
  } catch (error) {
    response.status(502).json({ message: error instanceof Error ? error.message : 'Die Testnachricht konnte nicht gesendet werden.' })
  }
})

app.get('/api/attendance', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const from = germanDate(request.query.from)
  const until = germanDate(request.query.until)
  if (!from || !until || String(request.query.from) > String(request.query.until)) return void response.status(400).json({ message: 'Der Zeitraum ist ungültig.' })
  try {
    const parameters = selectedFilters(request, ['SJ'])
    parameters.set('KlaBuDatumVon', from)
    parameters.set('KlaBuDatumBis', until)
    parameters.set(request.query.onlyAbsences === '1' ? 'NurFehlzeiten' : 'NurFehlzeitenOff', '1')
    response.json(await fetchSchoolArea(session, '/page2/page-2/', parameters))
  } catch (error) { areaError(response, error) }
})

app.get('/api/homework', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const from = germanDate(request.query.from)
  const until = germanDate(request.query.until)
  if (!from || !until || String(request.query.from) > String(request.query.until)) return void response.status(400).json({ message: 'Der Zeitraum ist ungültig.' })
  try {
    const parameters = selectedFilters(request, ['Kurs', 'Fach', 'Raum', 'LK', 'vonTag', 'bisTag', 'vonh', 'bish'])
    parameters.set('KlaBuDatumVon', from)
    parameters.set('KlaBuDatumBis', until)
    response.json(await fetchSchoolArea(session, '/page2/page-24/', parameters))
  } catch (error) { areaError(response, error) }
})

app.get('/api/messages', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  try { response.json(await fetchSchoolArea(session, '/page-5/page-20/')) } catch (error) { areaError(response, error) }
})

app.get('/api/block-plans', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const parameters = selectedFilters(request, ['Schuljahr'])
  if (!parameters.has('Schuljahr')) parameters.set('Schuljahr', String(new Date().getFullYear()))
  try { response.json(await fetchSchoolArea(session, '/page-5/page-25/index.php', parameters)) } catch (error) { areaError(response, error) }
})

app.get('/api/classes', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  try { response.json({ options: await fetchClasses(session) }) } catch (error) { areaError(response, error) }
})

app.get('/api/class-timetable', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const start = germanDate(request.query.start)
  const className = typeof request.query.class === 'string' ? request.query.class : ''
  if (!start || !className || className.length > 80) return void response.status(400).json({ message: 'Klasse oder Datum ist ungültig.' })
  try {
    response.json({ days: await fetchClassWeek(session, className, String(request.query.start), request.query.effective === '1'), source: 'live', className, labels: config.labels, fetchedAt: new Date().toISOString() })
  } catch (error) { areaError(response, error) }
})

app.get('/api/files', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const area = typeof request.query.area === 'string' && request.query.area.length <= 100 ? request.query.area : undefined
  try { response.json(await fetchFiles(session, area)) } catch (error) { areaError(response, error) }
})

app.get('/api/files/open', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const href = typeof request.query.href === 'string' ? request.query.href : ''
  if (!href || href.length > 2_000) return void response.status(400).json({ message: 'Der Dateilink ist ungültig.' })
  try {
    const upstream = await fetchSharedFile(session, href)
    const type = upstream.headers.get('content-type')
    const disposition = upstream.headers.get('content-disposition')
    if (type) response.setHeader('content-type', type)
    if (disposition) response.setHeader('content-disposition', disposition)
    response.send(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) { areaError(response, error) }
})

app.get('/api/student-card', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  try { response.json({ pages: await fetchStudentCard(session) }) } catch (error) { areaError(response, error) }
})

const sickNotesInFlight = new Set<string>()
const uncertainSickNotes = new Map<string, number>()

app.post('/api/sick-notes', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const from = germanDate(request.body?.from)
  const until = germanDate(request.body?.until)
  if (!from || !until) return void response.status(400).json({ message: 'Der Zeitraum ist ungültig.' })
  if (new Date(request.body.from) > new Date(request.body.until)) return void response.status(400).json({ message: 'Das Enddatum liegt vor dem Startdatum.' })
  const key = JSON.stringify([session, from, until])
  for (const [entry, expires] of uncertainSickNotes) if (expires <= Date.now()) uncertainSickNotes.delete(entry)
  if (sickNotesInFlight.has(session) || uncertainSickNotes.has(key)) return void response.status(409).json({ message: 'Dieser Zeitraum wird bereits übermittelt oder wurde schon gesendet. Bitte prüfe den Stand im Originalportal.' })
  sickNotesInFlight.add(session)
  try {
    await submitSickNote(session, from, until)
    response.status(204).end()
  } catch (error) {
    if (error instanceof SickNoteUncertainError) {
      if (uncertainSickNotes.size >= 512) uncertainSickNotes.delete(uncertainSickNotes.keys().next().value!)
      uncertainSickNotes.set(key, Date.now() + config.sessionTtlMs)
      response.status(502).json({ message: error.message })
    } else { areaError(response, error) }
  } finally { sickNotesInFlight.delete(session) }
})

if (process.env.NODE_ENV === 'production') {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
  const clientDirectory = path.resolve(currentDirectory, '../../dist/client')
  app.use(express.static(clientDirectory))
  app.get('*splat', (_request, response) => response.sendFile(path.join(clientDirectory, 'index.html')))
}

export { app }

if (process.env.NODE_ENV !== 'test') app.listen(config.port, config.host, () => {
  console.log(`Klarstunde läuft auf http://${config.host}:${config.port}`)
  void scheduleWatch.start()
})
