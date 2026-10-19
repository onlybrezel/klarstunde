import { FormEvent, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { isoDate } from '../date'
import { ApiError, submitSickNote } from '../api'
import { isIsoDate } from '../../shared/date'
import { loadError, type LoadError } from '../diagnostics'
import { ErrorState } from './PageState'

export function SickNotePage() {
  const today = isoDate(new Date())
  const [from, setFrom] = useState(today)
  const [until, setUntil] = useState(today)
  const [error, setError] = useState<LoadError>()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const submitting = useRef(false)
  const mailBody = encodeURIComponent(`Hallo,\n\nich bin vom ${new Date(`${from}T12:00:00`).toLocaleDateString('de-DE')} bis voraussichtlich ${new Date(`${until}T12:00:00`).toLocaleDateString('de-DE')} krankgemeldet.\n\nViele Grüße`)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || uncertain) return
    if (!isIsoDate(from) || !isIsoDate(until) || from > until) {
      setError({ message: 'Bitte wähle einen gültigen Zeitraum.', category: 'invalid-input' })
      return
    }
    const question = `Krankmeldung vom ${new Date(`${from}T12:00:00`).toLocaleDateString('de-DE')} bis ${new Date(`${until}T12:00:00`).toLocaleDateString('de-DE')} verbindlich absenden?`
    if (!window.confirm(question)) return
    submitting.current = true
    setBusy(true); setError(undefined); setSent(false)
    try { await submitSickNote(from, until); setSent(true) } catch (reason) {
      const unclear = !(reason instanceof ApiError) || reason.status >= 500 || reason.status === 409
      setUncertain(unclear)
      const detail = loadError(reason, 'Die Meldung konnte nicht gesendet werden.')
      setError({ ...detail, message: unclear ? 'Die Übermittlung ist nicht eindeutig bestätigt. Bitte prüfe den Stand im Originalportal, bevor du erneut eine Krankmeldung sendest.' : detail.message })
    } finally { setBusy(false); submitting.current = false }
  }

  return <div className="content-area narrow-area"><div className="area-heading"><p className="eyebrow">Abwesenheit melden</p><h1>Krankmeldung</h1><p>Wähle den vollständigen Zeitraum aus. Vor dem Absenden erscheint noch einmal eine Zusammenfassung.</p></div><aside className="area-note"><strong>Wichtig</strong><p>Die Meldung ersetzt kein Attest. Wenn du in Ausbildung bist, informiere zusätzlich deinen Betrieb.</p></aside>
    {sent ? <div className="success-stack"><div className="success-card"><CheckCircle2 /><div><strong>Krankmeldung gesendet</strong><p>Der ausgewählte Zeitraum wurde übermittelt.</p></div></div><a className="secondary-action" href={`mailto:?subject=${encodeURIComponent('Krankmeldung')}&body=${mailBody}`}>Betrieb per E-Mail informieren</a></div> : <form className="action-card" onSubmit={submit}><label>Erster Krankheitstag<input type="date" value={from} disabled={busy || uncertain} onChange={(event) => setFrom(event.target.value)} required /></label><label>Voraussichtlich letzter Krankheitstag<input type="date" value={until} disabled={busy || uncertain} min={from} onChange={(event) => setUntil(event.target.value)} required /></label>{error && <ErrorState error={error} area="sick-note" title="Übermittlung prüfen" />}<button className="primary-button" disabled={busy || uncertain}>{busy ? 'Wird gesendet …' : uncertain ? 'Bitte im Originalportal prüfen' : 'Krankmeldung prüfen'}</button>{uncertain && <a className="secondary-action" href="https://virtueller-stundenplan.org/page-8/" target="_blank" rel="noreferrer">Originalportal öffnen</a>}</form>}
  </div>
}
