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
  })
  if (!response.ok) {
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

export function getTimetable(start: string, demo: boolean): Promise<TimetableResponse> {
  const query = new URLSearchParams({ start })
  if (demo) query.set('demo', '1')
  return request(`/api/timetable?${query}`)
}

export function getSchoolArea(area: 'attendance' | 'homework', from: string, until: string, filters: Record<string, string>, onlyAbsences = false): Promise<SchoolAreaResponse> {
  const query = new URLSearchParams({ from, until, ...filters })
  if (onlyAbsences) query.set('onlyAbsences', '1')
  return request(`/api/${area}?${query}`)
}

export function getSimpleArea(area: 'messages' | 'block-plans', filters: Record<string, string> = {}): Promise<SchoolAreaResponse> {
  const query = new URLSearchParams(filters)
  return request(`/api/${area}${query.size ? `?${query}` : ''}`)
}

export function getClasses(): Promise<{ options: SchoolOption[] }> {
  return request('/api/classes')
}

export function getClassTimetable(className: string, start: string): Promise<SchoolAreaResponse> {
  return request(`/api/class-timetable?${new URLSearchParams({ class: className, start })}`)
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
