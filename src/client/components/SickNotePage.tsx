import { FormEvent, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { isoDate } from '../date'
import { submitSickNote } from '../api'

export function SickNotePage() {
  const today = isoDate(new Date())
  const [from, setFrom] = useState(today)
  const [until, setUntil] = useState(today)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const mailBody = encodeURIComponent(`Hallo,\n\nich bin vom ${new Date(`${from}T12:00:00`).toLocaleDateString('de-DE')} bis voraussichtlich ${new Date(`${until}T12:00:00`).toLocaleDateString('de-DE')} krankgemeldet.\n\nViele Grüße`)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const question = `Krankmeldung vom ${new Date(`${from}T12:00:00`).toLocaleDateString('de-DE')} bis ${new Date(`${until}T12:00:00`).toLocaleDateString('de-DE')} verbindlich absenden?`
    if (!window.confirm(question)) return
    setBusy(true); setError(''); setSent(false)
    try { await submitSickNote(from, until); setSent(true) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Die Krankmeldung konnte nicht gesendet werden.') } finally { setBusy(false) }
  }

  return <div className="content-area narrow-area"><div className="area-heading"><p className="eyebrow">Abwesenheit melden</p><h1>Krankmeldung</h1><p>Wähle den vollständigen Zeitraum aus. Vor dem Absenden erscheint noch einmal eine Zusammenfassung.</p></div><aside className="area-note"><strong>Wichtig</strong><p>Die Meldung ersetzt kein Attest. Wenn du in Ausbildung bist, informiere zusätzlich deinen Betrieb.</p></aside>
    {sent ? <div className="success-stack"><div className="success-card"><CheckCircle2 /><div><strong>Krankmeldung gesendet</strong><p>Der ausgewählte Zeitraum wurde übermittelt.</p></div></div><a className="secondary-action" href={`mailto:?subject=${encodeURIComponent('Krankmeldung')}&body=${mailBody}`}>Betrieb per E-Mail informieren</a></div> : <form className="action-card" onSubmit={submit}><label>Erster Krankheitstag<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label><label>Voraussichtlich letzter Krankheitstag<input type="date" value={until} min={from} onChange={(event) => setUntil(event.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Wird gesendet …' : 'Krankmeldung prüfen'}</button></form>}
  </div>
}
