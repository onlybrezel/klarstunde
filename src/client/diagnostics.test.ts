import { describe, expect, it } from 'vitest'
import { ApiError, ConnectionError, InvalidResponseError } from './api'
import { diagnosticText, loadError, type DiagnosticArea, type DiagnosticCategory } from './diagnostics'

describe('safe error details', () => {
  it.each([
    [new ConnectionError('private text'), 'connection'], [new InvalidResponseError('private text'), 'invalid-response'],
    [new ApiError('private text', 401), 'session'], [new ApiError('private text', 403), 'access'],
    [new ApiError('private text', 400), 'invalid-input'], [new ApiError('private text', 502), 'upstream'],
    [new Error('private text'), 'unknown'],
  ])('classifies errors without copying their messages', (error, category) => {
    const result = loadError(error, 'fallback')
    expect(result.category).toBe(category)
    expect(diagnosticText('files', result.category)).not.toContain('private text')
  })
  it('allows only the fixed report fields and rejects arbitrary runtime values', () => {
    const report = diagnosticText('private@example.invalid' as DiagnosticArea, 'cookie=secret' as DiagnosticCategory)
    expect(report.split('\n')).toHaveLength(3)
    expect(report).toMatch(/^Klarstunde [\d.]+\nBereich: unknown\nFehlerkategorie: unknown$/)
    expect(report).not.toMatch(/private|cookie|secret/)
  })
})
