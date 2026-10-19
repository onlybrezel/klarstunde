import { useEffect, useRef, useState } from 'react'
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Info, RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { TimetableResponse } from '../../shared/timetable'
import { isIsoDate, shiftDate, weekStart } from '../../shared/date'
import { getTeachingDate, getTimetable } from '../api'
import { isoDate, weekLabel } from '../date'
import { Timetable } from './Timetable'

export function PlanPage({ demo }: { demo: boolean }) {
  const [date, setDate] = useState(() => isoDate(new Date()))
  const [view, setView] = useState<'day' | 'week'>(() => window.matchMedia('(max-width: 600px)').matches ? 'day' : 'week')
  const [effective, setEffective] = useState(false)
  const [compact, setCompact] = useState(false)
  const [compare, setCompare] = useState(false)
  const [data, setData] = useState<TimetableResponse>()
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
    const refresh = forceRefresh.current
    forceRefresh.current = false
    getTimetable(start, demo, { view, effective, compare, refresh, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result) })
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
    try {
      const result = await getTeachingDate(date, direction, controller.signal)
      if (!controller.signal.aborted) setDate(result.date)
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Die Unterrichtswoche konnte nicht geladen werden.')
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
          <button aria-pressed={view === 'day'} onClick={() => setView('day')}>Tag</button>
          <button aria-pressed={view === 'week'} onClick={() => setView('week')}>Woche</button>
        </div>
        <details className="display-settings" ref={settings} onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
          <summary><SlidersHorizontal size={16} />Ansicht<ChevronDown size={14} /></summary>
          <div className="display-settings-panel">
            <p>Darstellung</p>
            <label><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />Kompakt</label>
            <label><input type="checkbox" checked={effective} onChange={(event) => setEffective(event.target.checked)} />Effektiver Plan</label>
            <label><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />Mit Klassenplan vergleichen</label>
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
    {error && <div className="state-card error-state" role="alert"><strong>Plan nicht verfügbar</strong><p>{error}</p><button onClick={refresh}>Noch einmal versuchen</button></div>}
    {(loading || navigating) && <div className="schedule-skeleton" role="status" aria-label="Stundenplan wird geladen"><span /><span /><span /><span /></div>}
    {!loading && !navigating && !error && data && <>
      {data.comparisonMessage && <p role="status">{data.comparisonMessage}</p>}
      {compare && data.className && <p className="comparison-caption"><span>Klassenvergleich</span>{data.className}</p>}
      {view === 'week' && <span className="mobile-scroll-hint">Seitlich wischen für weitere Tage</span>}
      <Timetable days={data.days} labels={data.labels} classDays={compare ? data.classDays : undefined} compact={compact} />
      {data.fetchedAt && <p className="fetch-status"><span className="status-dot" aria-hidden="true" />{demo ? 'Beispieldaten' : 'Zuletzt abgerufen'} · {new Date(data.fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>}
    </>}
    <p className="source-note">Verbindlich sind die Angaben im Originalportal. Prüfe den Plan besonders vor Unterrichtsbeginn.</p>
  </>
}
