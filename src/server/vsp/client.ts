import { config } from '../config.js'
import * as cheerio from 'cheerio'
import { ownClass, parseClassWeek, parseTimetableDay, timetableDate } from './timetable-parser.js'
import type { TimetableDay, TimetableResponse } from '../../shared/timetable.js'
import { germanDate, shiftDate, weekStart } from '../../shared/date.js'
import { parseFilters, parseNotices, parseOptions, parseSharedFiles, parseStudentCard, parseTables } from './school-parser.js'
import type { SchoolAreaResponse, SchoolFilter, SchoolOption, SharedFile, StudentCardPage } from '../../shared/school.js'

export class UpstreamUnavailableError extends Error {}
export class UpstreamSessionExpiredError extends UpstreamUnavailableError {}

function upstreamUrl(path: string): URL {
  return new URL(path, config.upstreamBaseUrl)
}

function phpSessionFrom(response: Response): string | undefined {
  const setCookies = response.headers.getSetCookie()
  for (const cookie of setCookies) {
    const match = cookie.match(/(?:^|;\s*)PHPSESSID=([^;]+)/)
    if (match) return match[1]
  }
  return undefined
}

export async function login(email: string, password: string): Promise<string | undefined> {
  const loginPage = await fetch(upstreamUrl('/'), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  })
  if (!loginPage.ok) throw new UpstreamUnavailableError(`Anmeldeseite endete mit Status ${loginPage.status}.`)
  const initialSessionId = phpSessionFrom(loginPage)
  const $ = cheerio.load(await loginPage.text())
  const formName = $('form input[name="formName"]').attr('value')
  if (!formName) throw new UpstreamUnavailableError('Das Anmeldeformular hat sich geändert.')

  const body = new URLSearchParams({
    MAIL: email,
    SCHUELERCODE: password,
    formAction: 'login',
    formName,
  })

  const response = await fetch(upstreamUrl('/index.php'), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(initialSessionId ? { cookie: `PHPSESSID=${initialSessionId}` } : {}),
    },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  const location = response.headers.get('location')
  if (!response.ok && response.status !== 302) throw new UpstreamUnavailableError(`Anmeldung endete mit Status ${response.status}.`)
  if (location && new URL(location, config.upstreamBaseUrl).pathname === '/') return undefined
  return phpSessionFrom(response) ?? initialSessionId
}

const sessionQueues = new Map<string, Promise<unknown>>()

// The portal keeps the selected day in its session. Navigation must be atomic.
async function inSession<T>(session: string, work: () => Promise<T>): Promise<T> {
  const previous = sessionQueues.get(session) ?? Promise.resolve()
  const pending = previous.catch(() => undefined).then(work)
  sessionQueues.set(session, pending)
  try { return await pending } finally {
    if (sessionQueues.get(session) === pending) sessionQueues.delete(session)
  }
}

function timetableParameters(date: string, effective = false): URLSearchParams {
  return new URLSearchParams({ KlaBuDatum: date, [effective ? 'HideChanges' : 'HideChangesOff']: '1', CompactOff: '1' })
}

export async function fetchTimetableDay(upstreamSessionId: string, date: string): Promise<TimetableDay> {
  return inSession(upstreamSessionId, async () => {
    const html = await fetchAuthenticatedPage(upstreamSessionId, '/page2/index.php', timetableParameters(date))
    return parseTimetableDay(html, timetableDate(html))
  })
}

interface TimetableOptions {
  effective: boolean
  compare: boolean
  count: 1 | 7
}

const timetableCache = new Map<string, { expires: number; pending: Promise<TimetableResponse> }>()

export function fetchTimetable(upstreamSessionId: string, start: string, options: TimetableOptions, refresh = false): Promise<TimetableResponse> {
  const key = JSON.stringify([upstreamSessionId, start, options.count, options.effective, options.compare])
  for (const [entryKey, entry] of timetableCache) if (entry.expires <= Date.now()) timetableCache.delete(entryKey)
  const existing = timetableCache.get(key)
  if (existing && (!refresh || existing.expires === Infinity)) return existing.pending
  const weekly = !refresh && options.count === 1 && !options.compare
    ? timetableCache.get(JSON.stringify([upstreamSessionId, weekStart(start), 7, options.effective, false])) : undefined
  const pending: Promise<TimetableResponse> = options.compare
    ? fetchTimetable(upstreamSessionId, start, { ...options, compare: false }, refresh).then(async (result) => ({
      ...result,
      ...(result.className
        ? { classDays: await fetchClassWeek(upstreamSessionId, result.className, start, options.effective) }
        : { comparisonMessage: 'Die eigene Klasse konnte nicht ermittelt werden. Bitte öffne die Klassenpläne.' }),
    }))
    : weekly ? weekly.pending.then((result) => ({ ...result, days: result.days.filter((day) => day.date === start) }))
      : inSession(upstreamSessionId, async () => {
        const days: TimetableDay[] = []
        let className: string | undefined
        for (let index = 0; index < options.count; index += 1) {
          const date = shiftDate(start, index)
          const html = await fetchAuthenticatedPage(upstreamSessionId, '/page2/index.php', timetableParameters(germanDate(date)!, options.effective))
          if (timetableDate(html) !== date) throw new UpstreamUnavailableError('Das Portal hat einen anderen Tag geliefert. Bitte lade den Plan erneut.')
          days.push(parseTimetableDay(html, date))
          if (index === 0) className = ownClass(html)
        }
        return {
          days, source: 'live' as const, fetchedAt: new Date().toISOString(), className,
        }
      })
  if (timetableCache.size >= 32) timetableCache.delete(timetableCache.keys().next().value!)
  const entry = { expires: Infinity, pending }
  timetableCache.set(key, entry)
  void pending.then((result) => { entry.expires = Date.parse(result.fetchedAt!) + 30_000 }, () => {
    if (timetableCache.get(key) === entry) timetableCache.delete(key)
  })
  return pending
}

export function clearTimetableCache(session: string): void {
  for (const key of timetableCache.keys()) {
    if ((JSON.parse(key) as unknown[])[0] === session) timetableCache.delete(key)
  }
}

const cacheCleanup = setInterval(() => {
  for (const [key, entry] of timetableCache) if (entry.expires <= Date.now()) timetableCache.delete(key)
}, 30_000)
cacheCleanup.unref()

async function classWeek(session: string, className: string, start: string, effective: boolean): Promise<TimetableDay[]> {
  const parameters = timetableParameters(germanDate(start)!, effective)
  parameters.set('Klasse', className)
  return parseClassWeek(await fetchAuthenticatedPage(session, '/page-5/index.php', parameters), start)
}

export function fetchClassWeek(session: string, className: string, start: string, effective = false): Promise<TimetableDay[]> {
  return inSession(session, () => classWeek(session, className, start, effective))
}

export function fetchTeachingDate(session: string, start: string, direction: 'previous' | 'next'): Promise<string> {
  return inSession(session, async () => {
    const html = await fetchAuthenticatedPage(session, '/page2/index.php', timetableParameters(germanDate(start)!))
    if (timetableDate(html) !== start) throw new UpstreamUnavailableError('Der Ausgangstag konnte nicht geladen werden.')
    const $ = cheerio.load(html)
    const label = direction === 'next' ? 'Unterrichtswoche +' : 'Unterrichtswoche -'
    const href = $('a[href]').filter((_, link) => $(link).text().trim() === label).first().attr('href')
    if (!href) throw new UpstreamUnavailableError('Die Navigation zur Unterrichtswoche ist im Portal nicht verfügbar.')
    const url = new URL(href, upstreamUrl('/page2/'))
    const expected = direction === 'next' ? '/page2/page-17/index.php' : '/page2/page-18/index.php'
    if (url.origin !== upstreamUrl('/').origin || url.pathname !== expected) throw new UpstreamUnavailableError('Die Unterrichtswochen-Navigation hat sich geändert.')
    const date = timetableDate(await fetchAuthenticatedPage(session, `${url.pathname}${url.search}`))
    if (direction === 'next' ? date <= start : date >= start) throw new UpstreamUnavailableError('Das Portal hat keine weitere Unterrichtswoche geliefert.')
    return date
  })
}

async function fetchAuthenticatedPage(upstreamSessionId: string, pathname: string, parameters?: URLSearchParams): Promise<string> {
  let url = upstreamUrl(pathname)
  if (parameters) url.search = parameters.toString()
  const base = new URL(config.upstreamBaseUrl)
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { cookie: `PHPSESSID=${upstreamSessionId}` },
      signal: AbortSignal.timeout(15_000),
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      const target = new URL(location, url)
      if (target.origin !== base.origin || target.pathname === '/') throw new UpstreamSessionExpiredError('Die Sitzung ist abgelaufen. Bitte melde dich erneut an.')
      url = target
      continue
    }
    if (response.status === 401) throw new UpstreamSessionExpiredError('Die Sitzung ist abgelaufen. Bitte melde dich erneut an.')
    if (!response.ok) throw new UpstreamUnavailableError(`Abruf endete mit Status ${response.status}.`)
    const html = await response.text()
    const $ = cheerio.load(html)
    if ($('form').toArray().some((form) => $(form).find('input[name="MAIL"]').length && $(form).find('input[name="SCHUELERCODE"]').length)) {
      throw new UpstreamSessionExpiredError('Die Sitzung ist abgelaufen. Bitte melde dich erneut an.')
    }
    return html
  }
  throw new UpstreamUnavailableError('Der Bereich enthält zu viele Weiterleitungen.')
}

export async function fetchSchoolArea(upstreamSessionId: string, pathname: string, parameters?: URLSearchParams): Promise<SchoolAreaResponse> {
  const html = await inSession(upstreamSessionId, () => fetchAuthenticatedPage(upstreamSessionId, pathname, parameters))
  return { tables: parseTables(html), notices: parseNotices(html), filters: parseFilters(html) }
}

export async function fetchClasses(upstreamSessionId: string): Promise<SchoolOption[]> {
  return parseOptions(await inSession(upstreamSessionId, () => fetchAuthenticatedPage(upstreamSessionId, '/page-5/')), 'Klasse')
}

export async function fetchFiles(upstreamSessionId: string, area?: string): Promise<{ files: SharedFile[]; filters: SchoolFilter[] }> {
  const html = await inSession(upstreamSessionId, () => fetchAuthenticatedPage(upstreamSessionId, '/page-19/', area ? new URLSearchParams({ LF: area }) : undefined))
  return { files: parseSharedFiles(html), filters: parseFilters(html) }
}

export async function fetchSharedFile(upstreamSessionId: string, href: string): Promise<Response> {
  const base = new URL(config.upstreamBaseUrl)
  let url = new URL(href, upstreamUrl('/page-19/'))
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const allowedPath = url.pathname.startsWith('/page-19/') || url.pathname.startsWith('/page-5/page-25/code-3/')
    if (url.origin !== base.origin || !allowedPath) throw new UpstreamUnavailableError('Dieser Dateilink ist nicht zulässig.')
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { cookie: `PHPSESSID=${upstreamSessionId}` },
      signal: AbortSignal.timeout(30_000),
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url)
      continue
    }
    if (!response.ok) throw new UpstreamUnavailableError(`Dateiabruf endete mit Status ${response.status}.`)
    return response
  }
  throw new UpstreamUnavailableError('Der Dateilink enthält zu viele Weiterleitungen.')
}

export async function fetchStudentCard(upstreamSessionId: string): Promise<StudentCardPage[]> {
  return parseStudentCard(await inSession(upstreamSessionId, () => fetchAuthenticatedPage(upstreamSessionId, '/page2/page-22/')))
}

export async function submitSickNote(upstreamSessionId: string, from: string, until: string): Promise<void> {
  const parameters = new URLSearchParams({ KlaBuDatumVon: from, KlaBuDatumBis: until, EintragenAction: 'krank melden' })
  let html: string
  try {
    html = await inSession(upstreamSessionId, () => fetchAuthenticatedPage(upstreamSessionId, '/page-8/', parameters))
  } catch {
    throw new SickNoteUncertainError('Die Antwort konnte nicht gelesen werden. Bitte prüfe deine Krankmeldung im Originalportal, bevor du sie erneut sendest.')
  }
  const $ = cheerio.load(html)
  const error = $('.alert-danger, .alert-error').first().text().trim()
  if (error) throw new UpstreamUnavailableError(error)
  // A success response has not been verified with a live submission.
  // Never turn the absence of a known error into a claimed success.
  throw new SickNoteUncertainError('Die Antwort bestätigt die Übermittlung nicht eindeutig. Bitte prüfe deine Krankmeldung im Originalportal, bevor du sie erneut sendest.')
}

export class SickNoteUncertainError extends Error {}
