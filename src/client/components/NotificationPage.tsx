import { useEffect, useState } from 'react'
import { BellRing, Check, Clock3, Send, ShieldCheck } from 'lucide-react'
import type { NotificationStatus } from '../../shared/notifications'
import { getNotificationStatus, sendNotificationTest } from '../api'

function dateTime(value?: string): string {
  if (!value) return 'Noch nicht'
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotificationPage() {
  const [status, setStatus] = useState<NotificationStatus>()
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    getNotificationStatus()
      .then(setStatus)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Der Status konnte nicht geladen werden.'))
  }, [])

  async function sendTest() {
    setSending(true)
    setSent(false)
    setError('')
    try {
      await sendNotificationTest()
      setSent(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Testnachricht konnte nicht gesendet werden.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="content-area narrow-area">
      <header className="area-heading">
        <p className="eyebrow">Telegram</p>
        <h1>Benachrichtigungen</h1>
        <p>Klarstunde prüft den Stundenplan regelmäßig und meldet bestätigte Änderungen direkt per Telegram.</p>
      </header>

      {error && <div className="notice-stack"><article><strong>Das hat nicht geklappt.</strong><p>{error}</p></article></div>}
      {!status && !error && <div className="area-loading">Status wird geladen …</div>}

      {status?.configured ? (
        <>
          <div className="notification-overview">
            <div className="notification-state"><span><BellRing size={20} /></span><div><strong>Telegram ist aktiv</strong><p>{status.running ? 'Der Stundenplan wird automatisch geprüft.' : 'Die Prüfung wird gerade gestartet.'}</p></div></div>
            <dl className="notification-details">
              <div><dt>Prüfung</dt><dd>Alle {status.intervalMinutes} Minuten</dd></div>
              <div><dt>Zeitraum</dt><dd>Nächste {status.watchedDays} Tage</dd></div>
              <div><dt>Zuletzt geprüft</dt><dd>{dateTime(status.lastCheckedAt)}</dd></div>
              <div><dt>Letzte Nachricht</dt><dd>{dateTime(status.lastNotificationAt)}</dd></div>
            </dl>
            {status.waitingForConfirmation && <p className="confirmation-note"><Clock3 size={17} /> Eine Änderung wurde gefunden und wird beim nächsten Abruf noch einmal geprüft.</p>}
          </div>
          <button className="primary-button notification-test" disabled={sending} onClick={() => void sendTest()}><Send size={18} />{sending ? 'Wird gesendet …' : 'Testnachricht senden'}</button>
          {sent && <div className="inline-success"><Check size={17} /> Testnachricht gesendet.</div>}
        </>
      ) : status ? (
        <div className="notification-setup">
          <div className="setup-heading"><span><BellRing size={21} /></span><div><strong>Telegram einrichten</strong><p>{status.message}</p></div></div>
          <ol>
            <li>In Telegram <strong>@BotFather</strong> öffnen und mit <code>/newbot</code> einen Bot anlegen.</li>
            <li>Dem neuen Bot einmal eine Nachricht schicken.</li>
            <li>Bot-Token und Chat-ID in der lokalen <code>.env</code> eintragen.</li>
            <li>Die Stundenplan-Prüfung aktivieren und Klarstunde neu starten.</li>
          </ol>
          <pre><code>{`TELEGRAM_BOT_TOKEN=…\nTELEGRAM_CHAT_ID=…\nTIMETABLE_WATCH_ENABLED=true`}</code></pre>
        </div>
      ) : null}

      <div className="privacy-strip"><ShieldCheck size={18} /><p><strong>Hinweis zum Datenschutz:</strong> Bei einer Änderung werden Datum, Stunde, Fach, Raum und Lehrkraft an Telegram gesendet.</p></div>
    </section>
  )
}
