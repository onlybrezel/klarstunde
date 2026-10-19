import { useId, useRef, useState } from 'react'
import { Copy, LoaderCircle } from 'lucide-react'
import { diagnosticText, type DiagnosticArea, type LoadError } from '../diagnostics'

export function LoadingState({ message = 'Daten werden geladen …' }: { message?: string }) {
  return <div className="area-loading" role="status"><LoaderCircle size={20} aria-hidden="true" /><span>{message}</span></div>
}

export function EmptyState({ title = 'Keine Einträge', message }: { title?: string; message: string }) {
  return <div className="empty-area" role="status"><strong>{title}</strong><p>{message}</p></div>
}

export function UnavailableState() {
  return <EmptyState title="Bereich nicht freigeschaltet" message="Das Originalportal meldet, dass dieser Bereich für dein Konto nicht freigeschaltet ist. Prüfe bei Fragen den Zugang im Originalportal." />
}

export function ErrorState({ error, area, title = 'Nicht verfügbar', onRetry, busy = false, retained = false }: { error: LoadError; area: DiagnosticArea; title?: string; onRetry?: () => void; busy?: boolean; retained?: boolean }) {
  const [copied, setCopied] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()
  const text = diagnosticText(area, error.category)
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied('Fehlerdetails kopiert.') }
    catch { field.current?.focus(); field.current?.select(); setCopied('Bitte den markierten Text selbst kopieren.') }
  }
  return <section className={`state-card error-state ${retained ? 'retained-error' : ''}`}>
    <div role="alert"><strong>{title}</strong><p>{error.message}</p></div>
    {onRetry && <button type="button" onClick={onRetry} disabled={busy}>Erneut versuchen</button>}
    <details className="error-details" onToggle={() => setCopied('')}>
      <summary>Fehlerdetails ansehen und kopieren</summary>
      <p>Diese Vorschau enthält nur App-Version, Bereich und Fehlerkategorie. Es wird nichts automatisch versendet.</p>
      <label htmlFor={fieldId}>Vorschau der Fehlerdetails</label>
      <textarea id={fieldId} ref={field} readOnly value={text} rows={3} />
      <button type="button" onClick={() => void copy()}><Copy size={15} aria-hidden="true" />Fehlerdetails kopieren</button>
      <span role="status">{copied}</span>
    </details>
  </section>
}
