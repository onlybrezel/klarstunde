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
import { fetchClasses, fetchFiles, fetchSchoolArea, fetchSharedFile, fetchStudentCard, fetchTimetableDay, login, submitSickNote, UpstreamUnavailableError } from './vsp/client.js'

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
    response.status(502).json({ message })
  }
})

app.delete('/api/session', (request, response) => {
  sessions.delete(readCookie(request, LOCAL_SESSION_COOKIE))
  clearSessionCookie(response)
  response.status(204).end()
})

app.get('/api/timetable', async (request, response) => {
  const start = typeof request.query.start === 'string' ? request.query.start : ''
  const demo = request.query.demo === '1'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    response.status(400).json({ message: 'Das Startdatum ist ungültig.' })
    return
  }
  if (demo) {
    response.json({ days: demoWeek(start), source: 'demo', labels: config.labels })
    return
  }

  const upstreamSessionId = sessions.get(readCookie(request, LOCAL_SESSION_COOKIE))
  if (!upstreamSessionId) {
    response.status(401).json({ message: 'Bitte melde dich erneut an.' })
    return
  }

  try {
    const monday = new Date(`${start}T12:00:00Z`)
    const days = await Promise.all(Array.from({ length: 5 }, (_, index) => {
      const date = new Date(monday)
      date.setUTCDate(monday.getUTCDate() + index)
      const germanDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date)
      return fetchTimetableDay(upstreamSessionId, germanDate).then((day) => ({ ...day, date: date.toISOString().slice(0, 10) }))
    }))
    response.json({ days, source: 'live', labels: config.labels })
  } catch (error) {
    const message = error instanceof UpstreamUnavailableError ? error.message : 'Der Stundenplan konnte nicht geladen werden.'
    response.status(502).json({ message })
  }
})

function authenticatedSession(request: express.Request, response: express.Response): string | undefined {
  const session = sessions.get(readCookie(request, LOCAL_SESSION_COOKIE))
  if (!session) response.status(401).json({ message: 'Bitte melde dich erneut an.' })
  return session
}

function germanDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

function areaError(response: express.Response, error: unknown): void {
  const message = error instanceof UpstreamUnavailableError ? error.message : 'Der Bereich konnte nicht geladen werden.'
  response.status(502).json({ message })
}

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
  if (!from || !until) return void response.status(400).json({ message: 'Der Zeitraum ist ungültig.' })
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
  if (!from || !until) return void response.status(400).json({ message: 'Der Zeitraum ist ungültig.' })
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
    response.json(await fetchSchoolArea(session, '/page-5/index.php', new URLSearchParams({ Klasse: className, KlaBuDatum: start, HideChangesOff: '1', CompactOff: '1' })))
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

app.post('/api/sick-notes', async (request, response) => {
  const session = authenticatedSession(request, response)
  if (!session) return
  const from = germanDate(request.body?.from)
  const until = germanDate(request.body?.until)
  if (!from || !until) return void response.status(400).json({ message: 'Der Zeitraum ist ungültig.' })
  if (new Date(request.body.from) > new Date(request.body.until)) return void response.status(400).json({ message: 'Das Enddatum liegt vor dem Startdatum.' })
  try {
    await submitSickNote(session, from, until)
    response.status(204).end()
  } catch (error) { areaError(response, error) }
})

if (process.env.NODE_ENV === 'production') {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
  const clientDirectory = path.resolve(currentDirectory, '../../dist/client')
  app.use(express.static(clientDirectory))
  app.get('*splat', (_request, response) => response.sendFile(path.join(clientDirectory, 'index.html')))
}

app.listen(config.port, config.host, () => {
  console.log(`Klarstunde läuft auf http://${config.host}:${config.port}`)
  void scheduleWatch.start()
})
