import { test as base, expect, type Page } from '@playwright/test'
import { shiftDate, weekStart } from '../../src/shared/date.js'
import { demoWeek } from '../../src/server/demo-data.js'

interface Portal {
  authenticated: boolean
  failure: '' | 'network' | 'upstream' | 'expired'
  availability?: 'unavailable'
  messages?: boolean
  requests: string[]
}

export const test = base.extend<{ portal: Portal }>({
  portal: [async ({ context }, use) => {
    const portal: Portal = { authenticated: false, failure: '', requests: [] }
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin !== 'http://127.0.0.1:5188') return route.abort()
      if (!url.pathname.startsWith('/api/')) return route.continue()
      portal.requests.push(url.pathname)
      const json = (body: unknown, status = 200) => route.fulfill({ status, json: body })
      switch (url.pathname) {
        case '/api/session':
          if (route.request().method() === 'POST') { portal.authenticated = true; return route.fulfill({ status: 204 }) }
          if (route.request().method() === 'DELETE') { portal.authenticated = false; return route.fulfill({ status: 204 }) }
          return json({ authenticated: portal.authenticated })
        case '/api/timetable': {
          if (portal.failure === 'network') return route.abort()
          if (portal.failure === 'expired') return json({ message: 'Bitte erneut anmelden.' }, 401)
          if (portal.failure === 'upstream') return json({ message: 'Testfehler mit privatem Inhalt: private@example.invalid' }, 502)
          const date = url.searchParams.get('start')!
          const allDays = demoWeek(weekStart(date))
          return json({ days: url.searchParams.get('view') === 'day' ? allDays.filter((day) => day.date === date) : allDays, source: 'demo', fetchedAt: '2026-10-19T12:00:00Z' })
        }
        case '/api/timetable/teaching-date':
          return json({ date: shiftDate(url.searchParams.get('start')!, url.searchParams.get('direction') === 'next' ? 7 : -7) })
        case '/api/student-card':
          return json({ pages: [{ title: 'Schülerausweis', kind: 'identity', text: 'Testdaten', schoolName: 'Beispielschule', fields: [{ label: 'Name', value: 'Alex Beispiel' }], images: [] }, { title: 'Prüfcode', kind: 'verification', text: 'Testabbildung · kein Nachweis', images: [{ alt: 'Testabbildung · kein Nachweis', role: 'code', source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1kAAAAASUVORK5CYII=' }] }], availability: portal.availability })
        case '/api/classes': return json({ options: [{ value: 'TEST', label: 'Beispielklasse' }] })
        case '/api/class-timetable': return json({ days: demoWeek(weekStart(url.searchParams.get('start')!)), source: 'demo' })
        case '/api/files': return json({ files: [], filters: [], availability: portal.availability })
        case '/api/sick-notes': return json({ message: 'Die nachgebildete Antwort ist nicht eindeutig bestätigt.' }, 502)
        case '/api/messages': case '/api/attendance': case '/api/homework': case '/api/block-plans':
          return json({ tables: [], notices: portal.messages && url.pathname === '/api/messages' ? [{ title: 'Beispielnachricht', body: 'Eine nachgebildete Mitteilung.' }] : [], filters: [], availability: portal.availability })
        default: throw new Error(`Unconfigured local UI fixture: ${url.pathname}`)
      }
    })
    await use(portal)
  }, { auto: true }],
})

export { expect }

export async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('Schul-E-Mail', { exact: true }).fill('beispiel@example.invalid')
  await page.getByLabel('Passwort', { exact: true }).fill('test-only')
  await page.getByRole('button', { name: 'Zum Stundenplan', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Stundenplan', exact: true })).toBeVisible()
}

export async function navigate(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Menü öffnen', exact: true })
  if (await menu.isVisible()) {
    await menu.click()
    await page.getByRole('dialog', { name: 'Hauptmenü', exact: true }).getByRole('button', { name: label, exact: true }).click()
  } else await page.getByRole('button', { name: label, exact: true }).click()
}
