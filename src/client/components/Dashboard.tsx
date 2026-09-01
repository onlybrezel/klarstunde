import { useEffect, useState } from 'react'
import { Bell, CalendarRange, ChevronLeft, ChevronRight, Menu, RefreshCw, X } from 'lucide-react'
import type { TimetableResponse } from '../../shared/timetable'
import { getTimetable } from '../api'
import { addDays, isoDate, mondayOf, weekLabel } from '../date'
import { Sidebar } from './Sidebar'
import { Timetable } from './Timetable'
import { AreaPage } from './AreaPage'
import { SickNotePage } from './SickNotePage'
import { FilesPage } from './FilesPage'
import { StudentCardPage } from './StudentCardPage'
import { ClassesPage } from './ClassesPage'
import { NotificationPage } from './NotificationPage'

interface DashboardProps {
  demo: boolean
  onLogout: () => void
}

export function Dashboard({ demo, onLogout }: DashboardProps) {
  const [week, setWeek] = useState(() => mondayOf(new Date()))
  const [data, setData] = useState<TimetableResponse>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeArea, setActiveArea] = useState('plan')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getTimetable(isoDate(week), demo)
      .then((result) => { if (active) setData(result) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Der Plan konnte nicht geladen werden.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [demo, reloadToken, week])

  return (
    <div className="app-shell">
      <div className={`mobile-drawer ${menuOpen ? 'open' : ''}`}><Sidebar demo={demo} active={activeArea} onNavigate={(area) => { setActiveArea(area); setMenuOpen(false) }} onLogout={onLogout} /></div>
      {menuOpen && <button className="drawer-backdrop" aria-label="Menü schließen" onClick={() => setMenuOpen(false)} />}
      <div className="desktop-sidebar"><Sidebar demo={demo} active={activeArea} onNavigate={setActiveArea} onLogout={onLogout} /></div>
      <main className="dashboard" id="plan">
        <header className="topbar">
          <button className="mobile-menu" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
          <div className="topbar-date"><span>{new Date().toLocaleDateString('de-DE', { weekday: 'long' })}</span>{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          <button className="icon-button" aria-label="Benachrichtigungen" onClick={() => setActiveArea('notifications')}><Bell size={20} /></button>
        </header>

        {activeArea === 'plan' && <><div className="plan-heading"><p className="eyebrow">Wochenübersicht</p><h1>Stundenplan</h1><p>Unterricht, Räume und Änderungen für deine aktuelle Schulwoche.</p></div><section className="week-toolbar">
          <div className="week-title"><CalendarRange size={19} /><strong>{weekLabel(week)}</strong>{data?.source === 'demo' && <span className="demo-pill">Demo</span>}</div>
          <div className="week-actions">
            <button onClick={() => setWeek(addDays(week, -7))} aria-label="Vorherige Woche"><ChevronLeft size={19} /></button>
            <button className="today-button" onClick={() => setWeek(mondayOf(new Date()))}>Heute</button>
            <button onClick={() => setWeek(addDays(week, 7))} aria-label="Nächste Woche"><ChevronRight size={19} /></button>
            <button onClick={() => setReloadToken((value) => value + 1)} aria-label="Neu laden"><RefreshCw size={17} /></button>
          </div>
        </section>

        {error && <div className="state-card error-state"><strong>Plan nicht verfügbar</strong><p>{error}</p><button onClick={() => setReloadToken((value) => value + 1)}>Noch einmal versuchen</button></div>}
        {loading && <div className="schedule-skeleton" aria-label="Stundenplan wird geladen"><span /><span /><span /><span /></div>}
        {!loading && !error && data && <><span className="mobile-scroll-hint">Seitlich wischen für weitere Tage</span><Timetable days={data.days} labels={data.labels} /></>}
        <p className="source-note">Der Stundenplan enthält auch Vertretungen und geplante Klausuren. Änderungen sind farblich markiert – prüfe den Plan besonders vor Unterrichtsbeginn.</p>
        </>}
        {activeArea === 'attendance' && <AreaPage area="attendance" title="Fehlzeiten, Klausuren & Noten" description="Deine Einträge aus dem Virtuellen Klassenbuch im gewählten Zeitraum." note="Ausbildungsbetriebe können Fehlzeiten ebenfalls einsehen und dich darüber entschuldigen, wenn deine Schule diese Funktion nutzt." />}
        {activeArea === 'homework' && <AreaPage area="homework" title="Klassenbuch & Hausaufgaben" description="Unterrichtsinhalte und Aufgaben aus deinen Kursen." note="Die Einträge werden von deinen Lehrkräften geführt. Mit dem Zeitraum kannst du vergangene Inhalte und kommende Aufgaben eingrenzen." />}
        {activeArea === 'messages' && <AreaPage area="messages" title="Nachrichten" description="Mitteilungen deiner Schule und deiner Klasse." note="Hier erscheinen sowohl allgemeine Schulnachrichten als auch Hinweise, die nur für deine Klasse bestimmt sind." />}
        {activeArea === 'notifications' && <NotificationPage />}
        {activeArea === 'blocks' && <AreaPage area="block-plans" title="Blockpläne" description="Blockunterricht und Schulwochen des laufenden Schuljahres." note="Blockpläne stehen nur zur Verfügung, wenn deine Schule Unterricht in Blöcken organisiert und die Ansicht freigeschaltet hat." />}
        {activeArea === 'sick' && <SickNotePage />}
        {activeArea === 'files' && <FilesPage />}
        {activeArea === 'classes' && <ClassesPage />}
        {activeArea === 'id-card' && <StudentCardPage />}
      </main>
    </div>
  )
}
