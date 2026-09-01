import { randomBytes } from 'node:crypto'

interface Session {
  upstreamSessionId: string
  expiresAt: number
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>()

  constructor(private readonly ttlMs: number) {}

  create(upstreamSessionId: string): string {
    const id = randomBytes(32).toString('base64url')
    this.sessions.set(id, {
      upstreamSessionId,
      expiresAt: Date.now() + this.ttlMs,
    })
    return id
  }

  get(id: string | undefined): string | undefined {
    if (!id) return undefined
    const session = this.sessions.get(id)
    if (!session) return undefined
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(id)
      return undefined
    }
    return session.upstreamSessionId
  }

  delete(id: string | undefined): void {
    if (id) this.sessions.delete(id)
  }
}
