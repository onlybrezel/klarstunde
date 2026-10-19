import { FormEvent, useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { createSession } from '../api'
import { Brand } from './Brand'
import { loadError, type LoadError } from '../diagnostics'
import { ErrorState } from './PageState'

interface LoginProps {
  expired?: boolean
  onLogin: () => void
  onDemo: () => void
}

export function Login({ onLogin, onDemo, expired = false }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<LoadError>()
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(undefined)
    try {
      await createSession(email, password)
      onLogin()
    } catch (error) {
      setMessage(loadError(error, 'Die Anmeldung ist fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-intro">
        <Brand />
        <div className="intro-copy">
          <p className="eyebrow">Dein Schultag auf einen Blick</p>
          <h1>Wissen, was<br /><em>heute ansteht.</em></h1>
          <p className="intro-text">Stundenplan, Vertretungen, Klausuren und Klassenbuch – übersichtlich an einem Ort.</p>
        </div>
        <div className="login-feature-list" aria-label="Enthaltene Bereiche">
          <span><strong>01</strong>Aktueller Wochenplan</span>
          <span><strong>02</strong>Fehlzeiten und Klausuren</span>
          <span><strong>03</strong>Nachrichten und Unterlagen</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="login-icon"><LockKeyhole size={21} /></span>
          <p className="eyebrow">Schulkonto</p>
          <h2>Anmelden</h2>
          {expired && <p className="session-notice" role="status">Deine Sitzung ist abgelaufen. Melde dich erneut an, um zur vorherigen Ansicht zurückzukehren.</p>}
          <p className="login-hint">Verwende dieselben Zugangsdaten wie beim Virtuellen Stundenplan.</p>
          <form onSubmit={submit} aria-busy={busy}>
            <label htmlFor="email">Schul-E-Mail</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@schule.de" required />
            <label htmlFor="password">Passwort</label>
            <div className="password-field">
              <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Dein Passwort" required />
              <button type="button" aria-label={showPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'} onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {message && <ErrorState error={message} area="login" title="Anmeldung fehlgeschlagen" />}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Anmeldung läuft …' : 'Zum Stundenplan'} <ArrowRight size={18} />
            </button>
          </form>
          <a className="password-reset" href="https://virtueller-stundenplan.org/page13/" target="_blank" rel="noreferrer">Passwort vergessen?</a>
          <button className="demo-button" type="button" onClick={onDemo}>Erst einmal ansehen</button>
          <p className="privacy-note">Deine Zugangsdaten bleiben nur für die Anmeldung im Arbeitsspeicher und werden nicht gespeichert.</p>
        </div>
      </section>
    </main>
  )
}
