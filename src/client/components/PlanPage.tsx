import { useEffect, useRef, useState } from 'react'
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Info, RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { TimetableResponse } from '../../shared/timetable'
import { isIsoDate, shiftDate, weekStart } from '../../shared/date'
import { getTeachingDate, getTimetable } from '../api'
import { isoDate, weekLabel } from '../date'
import { Timetable } from './Timetable'
import type { PlanSettings } from '../navigation'

export function PlanPage({ demo, settings: selected, onSettingsChange }: { demo: boolean; settings: PlanSettings; onSettingsChange: (settings: PlanSettings) => void }) {
  const { date, view, effective, compact, compare } = selected
  const setDate = (value: string) => onSettingsChange({ ...selected, date: value })
  const [data, setData] = useState<TimetableResponse>()
  const [shown, setShown] = useState({ start: '', view, compare, effective })
  const [navigationError, setNavigationError] = useState<'previous' | 'next'>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [navigating, setNavigating] = useState(false)
  const [reload, setReload] = useState(0)
  const forceRefresh = useRef(false)
  const navigation = useRef<AbortController | undefined>(undefined)
  const settings = useRef<HTMLDetailsElement>(null)
  const start = view === 'week' ? weekStart(date) : date

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNavigationError(undefined)
    const refresh = forceRefresh.current
    forceRefresh.current = false
    getTimetable(start, demo, { view, effective, compare, refresh, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setData(result); setShown({ start, view, compare, effective }) } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Der Plan konnte nicht geladen werden.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [start, demo, view, effective, compare, reload])

  useEffect(() => () => navigation.current?.abort(), [])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (settings.current && event.target instanceof Node && !settings.current.contains(event.target)) settings.current.open = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  async function teachingWeek(direction: 'previous' | 'next') {
    navigation.current?.abort()
    const controller = new AbortController()
    navigation.current = controller
    setNavigating(true)
    setError('')
    setNavigationError(undefined)
    try {
      const result = await getTeachingDate(date, direction, controller.signal)
      if (!controller.signal.aborted) setDate(result.date)
    } catch (reason) {
      if (!controller.signal.aborted) { setNavigationError(direction); setError(reason instanceof Error ? reason.message : 'Die Unterrichtswoche konnte nicht geladen werden.') }
    } finally { if (!controller.signal.aborted) setNavigating(false) }
  }

  function refresh() { forceRefresh.current = true; setReload((value) => value + 1) }
  const dateLabel = view === 'week' ? weekLabel(new Date(`${start}T12:00:00`))
    : new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return <>
    <div className="plan-heading">
      <div><p className="eyebrow">Dein Unterricht</p><h1>Stundenplan<span className="heading-dot" aria-hidden="true">.</span></h1><p>Unterricht, Räume und Änderungen im Überblick.</p></div>
      <div className="plan-heading-actions">
        <div className="view-switch" aria-label="Zeitraum anzeigen">
          <button aria-pressed={view === 'day'} onClick={() => onSettingsChange({ ...selected, view: 'day' })}>Tag</button>
          <button aria-pressed={view === 'week'} onClick={() => onSettingsChange({ ...selected, view: 'week' })}>Woche</button>
        </div>
        <details className="display-settings" ref={settings} onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
          <summary><SlidersHorizontal size={16} />Ansicht<ChevronDown size={14} /></summary>
          <div className="display-settings-panel">
            <p>Darstellung</p>
            <label><input type="checkbox" checked={compact} onChange={(event) => onSettingsChange({ ...selected, compact: event.target.checked })} />Kompakt</label>
            <label><input type="checkbox" checked={effective} onChange={(event) => onSettingsChange({ ...selected, effective: event.target.checked })} />Effektiver Plan</label>
            <label><input type="checkbox" checked={compare} onChange={(event) => onSettingsChange({ ...selected, compare: event.target.checked })} />Mit Klassenplan vergleichen</label>
          </div>
        </details>
      </div>
    </div>
    <div className="plan-controls">
    <section className="week-toolbar" aria-label="Stundenplan-Navigation">
      <div className="week-title"><span className="calendar-symbol"><CalendarRange size={20} /></span><div><span className="toolbar-kicker">{view === 'week' ? 'Deine Woche' : 'Dein Tag'}</span><strong>{dateLabel}</strong></div>{demo && <span className="demo-pill">Demo</span>}</div>
      <div className="week-actions">
        <button disabled={navigating} onClick={() => setDate(shiftDate(date, view === 'week' ? -7 : -1))} aria-label={view === 'week' ? 'Vorherige Woche' : 'Vorheriger Tag'}><ChevronLeft size={19} /></button>
        <button disabled={navigating} className="today-button" onClick={() => setDate(isoDate(new Date()))}>Heute</button>
        <button disabled={navigating} onClick={() => setDate(shiftDate(date, view === 'week' ? 7 : 1))} aria-label={view === 'week' ? 'Nächste Woche' : 'Nächster Tag'}><ChevronRight size={19} /></button>
        <button disabled={loading || navigating} onClick={refresh} aria-label="Neu laden"><RefreshCw size={17} /></button>
      </div>
    </section>
    <div className="plan-navigation">
      <label>Datum<input type="date" value={date} disabled={navigating} onChange={(event) => { if (isIsoDate(event.target.value)) setDate(event.target.value) }} /></label>
      {!demo && <div className="teaching-navigation" aria-label="Unterrichtswoche wechseln">
        <button disabled={navigating || loading} onClick={() => void teachingWeek('previous')}><ChevronLeft size={16} />Unterrichtswoche</button>
        <button disabled={navigating || loading} onClick={() => void teachingWeek('next')}>Unterrichtswoche<ChevronRight size={16} /></button>
      </div>}
    </div>
    </div>
    <div className="plan-context"><Info size={15} /><p>{compare ? 'Persönlicher Plan und Klassenplan im Vergleich.' : 'Prüfe auch den Klassenplan. Im persönlichen Plan können Stunden fehlen.'}{effective && ' Effektiver Plan ausgewählt.'}</p></div>
    <p className="sr-only" role="status">{loading || navigating ? 'Stundenplan wird geladen.' : error ? '' : 'Stundenplan geladen.'}</p>
    {error && <div className={`state-card error-state ${data ? 'retained-error' : ''}`} role="alert"><strong>{data ? 'Aktualisierung fehlgeschlagen' : 'Plan nicht verfügbar'}</strong><p>{error}</p><button disabled={loading || navigating} onClick={() => navigationError ? void teachingWeek(navigationError) : refresh()}>Erneut versuchen</button></div>}
    {(loading || navigating) && !data && <div className="schedule-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>}
    {data && <>
      {(loading || navigating || error) && <aside className="stale-plan" role="status"><strong>{error ? 'Letzter geladener Stand · nicht aktuell bestätigt' : 'Wird aktualisiert · bisheriger Stand'}</strong><span>{shown.view === 'week' ? weekLabel(new Date(`${shown.start}T12:00:00`)) : new Date(`${shown.start}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}{shown.effective && ' · Effektiver Plan'}{shown.compare && ' · Klassenvergleich'}</span></aside>}
      {data.comparisonMessage && <p role="status">{data.comparisonMessage}</p>}
      {shown.compare && data.className && <p className="comparison-caption"><span>Klassenvergleich</span>{data.className}</p>}
      {shown.view === 'week' && <span className="mobile-scroll-hint">Seitlich wischen für weitere Tage</span>}
      <Timetable days={data.days} labels={data.labels} classDays={shown.compare ? data.classDays : undefined} compact={compact} />
      {data.fetchedAt && <p className="fetch-status"><span className="status-dot" aria-hidden="true" />{demo ? 'Beispieldaten' : 'Zuletzt abgerufen'} · {new Date(data.fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>}
    </>}
    <p className="source-note">Verbindlich sind die Angaben im Originalportal. Prüfe den Plan besonders vor Unterrichtsbeginn.</p>
  </>
}
