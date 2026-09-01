import { config } from '../config.js'
import * as cheerio from 'cheerio'
import { parseTimetable } from './timetable-parser.js'
import type { TimetableDay } from '../../shared/timetable.js'
import { parseFilters, parseNotices, parseOptions, parseSharedFiles, parseStudentCard, parseTables } from './school-parser.js'
import type { SchoolAreaResponse, SchoolFilter, SchoolOption, SharedFile, StudentCardPage } from '../../shared/school.js'

export class UpstreamUnavailableError extends Error {}

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

export async function fetchTimetableDay(upstreamSessionId: string, date: string): Promise<TimetableDay> {
  const url = upstreamUrl('/page2/index.php')
  url.search = new URLSearchParams({ KlaBuDatum: date, HideChangesOff: '1', CompactOff: '1' }).toString()

  const response = await fetch(url, {
    redirect: 'manual',
    headers: { cookie: `PHPSESSID=${upstreamSessionId}` },
    signal: AbortSignal.timeout(15_000),
  })

  if (response.status === 302) throw new UpstreamUnavailableError('Die Sitzung ist abgelaufen.')
  if (!response.ok) throw new UpstreamUnavailableError(`Stundenplan endete mit Status ${response.status}.`)
  return { date, lessons: parseTimetable(await response.text()) }
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
      if (target.origin !== base.origin || target.pathname === '/') throw new UpstreamUnavailableError('Die Sitzung ist abgelaufen.')
      url = target
      continue
    }
    if (!response.ok) throw new UpstreamUnavailableError(`Abruf endete mit Status ${response.status}.`)
    return response.text()
  }
  throw new UpstreamUnavailableError('Der Bereich enthält zu viele Weiterleitungen.')
}

export async function fetchSchoolArea(upstreamSessionId: string, pathname: string, parameters?: URLSearchParams): Promise<SchoolAreaResponse> {
  const html = await fetchAuthenticatedPage(upstreamSessionId, pathname, parameters)
  return { tables: parseTables(html), notices: parseNotices(html), filters: parseFilters(html) }
}

export async function fetchClasses(upstreamSessionId: string): Promise<SchoolOption[]> {
  return parseOptions(await fetchAuthenticatedPage(upstreamSessionId, '/page-5/'), 'Klasse')
}

export async function fetchFiles(upstreamSessionId: string, area?: string): Promise<{ files: SharedFile[]; filters: SchoolFilter[] }> {
  const html = await fetchAuthenticatedPage(upstreamSessionId, '/page-19/', area ? new URLSearchParams({ LF: area }) : undefined)
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
  return parseStudentCard(await fetchAuthenticatedPage(upstreamSessionId, '/page2/page-22/'))
}

export async function submitSickNote(upstreamSessionId: string, from: string, until: string): Promise<void> {
  const parameters = new URLSearchParams({ KlaBuDatumVon: from, KlaBuDatumBis: until, EintragenAction: 'krank melden' })
  const html = await fetchAuthenticatedPage(upstreamSessionId, '/page-8/', parameters)
  const $ = cheerio.load(html)
  const error = $('.alert-danger, .alert-error').first().text().trim()
  if (error) throw new UpstreamUnavailableError(error)
}
