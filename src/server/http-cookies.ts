import type { Request, Response } from 'express'

export const LOCAL_SESSION_COOKIE = 'klarstunde_session'

export function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) return undefined

  for (const cookie of cookieHeader.split(';')) {
    const [key, ...valueParts] = cookie.trim().split('=')
    if (key === name) return decodeURIComponent(valueParts.join('='))
  }
  return undefined
}

export function setSessionCookie(response: Response, sessionId: string, maxAgeMs: number, secure: boolean): void {
  response.cookie(LOCAL_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: maxAgeMs,
    path: '/',
  })
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(LOCAL_SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', path: '/' })
}
