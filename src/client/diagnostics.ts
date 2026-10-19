import { version } from '../../package.json'
import { ApiError, ConnectionError, InvalidResponseError } from './api'

const areas = ['plan', 'attendance', 'homework', 'messages', 'block-plans', 'files', 'classes', 'student-card', 'login', 'sick-note'] as const
const categories = ['connection', 'session', 'access', 'invalid-input', 'upstream', 'invalid-response', 'unknown'] as const
export type DiagnosticArea = typeof areas[number]
export type DiagnosticCategory = typeof categories[number]
export interface LoadError { message: string; category: DiagnosticCategory }

export function loadError(reason: unknown, fallback: string): LoadError {
  const category: DiagnosticCategory = reason instanceof ConnectionError ? 'connection'
    : reason instanceof InvalidResponseError ? 'invalid-response'
      : reason instanceof ApiError ? reason.status === 401 ? 'session' : reason.status === 403 ? 'access'
        : reason.status === 400 || reason.status === 422 ? 'invalid-input' : reason.status >= 500 ? 'upstream' : 'unknown'
        : 'unknown'
  return { message: reason instanceof Error ? reason.message : fallback, category }
}

export function diagnosticText(area: DiagnosticArea, category: DiagnosticCategory): string {
  // Only fixed, non-personal fields enter the copyable report.
  return `Klarstunde ${version}\nBereich: ${areas.includes(area) ? area : 'unknown'}\nFehlerkategorie: ${categories.includes(category) ? category : 'unknown'}`
}
