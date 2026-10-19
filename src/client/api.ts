import type { TimetableResponse } from '../shared/timetable'
import type { SchoolAreaResponse, SchoolFilter, SchoolOption, SharedFile, StudentCardPage } from '../shared/school'
import type { NotificationStatus } from '../shared/notifications'

interface ApiErrorBody {
  message?: string
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  }).catch((error: unknown) => {
    if (options?.signal?.aborted) throw error
    throw new Error('Die Verbindung ist unterbrochen. Prüfe deine Verbindung und ob Klarstunde noch läuft. Versuche es anschließend erneut.')
  })
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/session') window.dispatchEvent(new Event('session-expired'))
    const body = await response.json().catch(() => ({})) as ApiErrorBody
    throw new ApiError(body.message ?? 'Etwas ist schiefgelaufen.', response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function getSession(): Promise<{ authenticated: boolean; automatic?: boolean }> {
  return request('/api/session')
}

export function createSession(email: string, password: string): Promise<void> {
  return request('/api/session', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function deleteSession(): Promise<void> {
  return request('/api/session', { method: 'DELETE' })
}

export function getTimetable(start: string, demo: boolean, options: { view: 'day' | 'week'; effective: boolean; compare: boolean; refresh?: boolean; signal?: AbortSignal }): Promise<TimetableResponse> {
  const query = new URLSearchParams({ start })
  if (demo) query.set('demo', '1')
  query.set('view', options.view)
  if (options.effective) query.set('effective', '1')
  if (options.compare) query.set('compare', '1')
  if (options.refresh) query.set('refresh', '1')
  return request(`/api/timetable?${query}`, { signal: options.signal })
}

export function getTeachingDate(start: string, direction: 'previous' | 'next', signal?: AbortSignal): Promise<{ date: string }> {
  return request(`/api/timetable/teaching-date?${new URLSearchParams({ start, direction })}`, { signal })
}

export function getSchoolArea(area: 'attendance' | 'homework', from: string, until: string, filters: Record<string, string>, onlyAbsences = false, signal?: AbortSignal): Promise<SchoolAreaResponse> {
  const query = new URLSearchParams({ from, until, ...filters })
  if (onlyAbsences) query.set('onlyAbsences', '1')
  return request(`/api/${area}?${query}`, { signal })
}

export function getSimpleArea(area: 'messages' | 'block-plans', filters: Record<string, string> = {}, signal?: AbortSignal): Promise<SchoolAreaResponse> {
  const query = new URLSearchParams(filters)
  return request(`/api/${area}${query.size ? `?${query}` : ''}`, { signal })
}

export function getClasses(): Promise<{ options: SchoolOption[] }> {
  return request('/api/classes')
}

export function getClassTimetable(className: string, start: string, effective = false, signal?: AbortSignal): Promise<TimetableResponse> {
  return request(`/api/class-timetable?${new URLSearchParams({ class: className, start, effective: effective ? '1' : '0' })}`, { signal })
}

export function getFiles(area = ''): Promise<{ files: SharedFile[]; filters: SchoolFilter[] }> {
  return request(`/api/files${area ? `?${new URLSearchParams({ area })}` : ''}`)
}

export function getStudentCard(): Promise<{ pages: StudentCardPage[] }> {
  return request('/api/student-card')
}

export function submitSickNote(from: string, until: string): Promise<void> {
  return request('/api/sick-notes', { method: 'POST', body: JSON.stringify({ from, until }) })
}

export function getNotificationStatus(): Promise<NotificationStatus> {
  return request('/api/notifications/status')
}

export function sendNotificationTest(): Promise<void> {
  return request('/api/notifications/test', { method: 'POST' })
}
