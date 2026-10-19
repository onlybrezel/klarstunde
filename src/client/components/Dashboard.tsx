import { useEffect, useRef, useState } from 'react'
import { BookOpen, IdCard, Menu, X } from 'lucide-react'
import type { PlanSettings } from '../navigation'
import { keepDialogFocus } from '../dialog'
import { Sidebar } from './Sidebar'
import { PlanPage } from './PlanPage'
import { AreaPage } from './AreaPage'
import { SickNotePage } from './SickNotePage'
import { FilesPage } from './FilesPage'
import { StudentCardPage } from './StudentCardPage'
import { ClassesPage } from './ClassesPage'

interface DashboardProps {
  demo: boolean
  onLogout: () => void
  activeArea: string
  onNavigate: (area: string) => void
  plan: PlanSettings
  onPlanChange: (settings: PlanSettings) => void
  preferencesSaved: boolean
  onResetDisplay: () => void
}

export function Dashboard({ demo, onLogout, activeArea, onNavigate, plan, onPlanChange, preferencesSaved, onResetDisplay }: DashboardProps) {
  const drawer = useRef<HTMLDialogElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const focusContent = useRef(false)
  useEffect(() => {
    const heading = main.current?.querySelector('h1')
    if (heading) { heading.tabIndex = -1; heading.focus() }
  }, [activeArea])
  useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)')
    const close = () => { if (media.matches) drawer.current?.close() }
    media.addEventListener('change', close)
    return () => media.removeEventListener('change', close)
  }, [])
  function navigate(area: string) { focusContent.current = true; drawer.current?.close(); onNavigate(area) }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Zum Inhalt</a>
      <dialog ref={drawer} id="mobile-navigation" className="navigation-dialog" aria-label="Hauptmenü" onKeyDown={keepDialogFocus} onClose={() => { setMenuOpen(false); if (focusContent.current) main.current?.querySelector('h1')?.focus(); else menuButton.current?.focus(); focusContent.current = false }} onClick={(event) => { if (event.target === event.currentTarget) drawer.current?.close() }}>
        <div className="drawer-content"><button className="drawer-close" onClick={() => drawer.current?.close()} aria-label="Menü schließen"><X /></button><Sidebar demo={demo} active={activeArea} onNavigate={navigate} onLogout={onLogout} /></div>
      </dialog>
      <div className="desktop-sidebar"><Sidebar demo={demo} active={activeArea} onNavigate={onNavigate} onLogout={onLogout} /></div>
      <main className="dashboard" id="main-content" ref={main} tabIndex={-1}>
        <header className="topbar">
          <button ref={menuButton} className="mobile-menu" aria-label="Menü öffnen" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => { drawer.current?.showModal(); setMenuOpen(true) }}><Menu /></button>
          <span className="topbar-context"><BookOpen size={16} />Deine Schulübersicht</span>
          {activeArea !== 'id-card' && <button className="card-shortcut" aria-label="Schülerausweis öffnen" onClick={() => onNavigate('id-card')}><IdCard size={18} /><span>Schülerausweis</span></button>}
          <div className="topbar-date"><span>{new Date().toLocaleDateString('de-DE', { weekday: 'long' })}</span>{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </header>

        {activeArea === 'plan' && <PlanPage demo={demo} settings={plan} onSettingsChange={onPlanChange} preferencesSaved={preferencesSaved} onResetDisplay={onResetDisplay} />}
        {activeArea === 'attendance' && <AreaPage area="attendance" title="Fehlzeiten, Klausuren & Noten" description="Deine Einträge aus dem Virtuellen Klassenbuch im gewählten Zeitraum." note="Ausbildungsbetriebe können Fehlzeiten ebenfalls einsehen und dich darüber entschuldigen, wenn deine Schule diese Funktion nutzt." />}
        {activeArea === 'homework' && <AreaPage area="homework" title="Klassenbuch & Hausaufgaben" description="Unterrichtsinhalte und Aufgaben aus deinen Kursen." note="Die Einträge werden von deinen Lehrkräften geführt. Mit dem Zeitraum kannst du vergangene Inhalte und kommende Aufgaben eingrenzen." />}
        {activeArea === 'messages' && <AreaPage area="messages" title="Nachrichten" description="Mitteilungen deiner Schule und deiner Klasse." note="Hier erscheinen sowohl allgemeine Schulnachrichten als auch Hinweise, die nur für deine Klasse bestimmt sind." />}
        {activeArea === 'blocks' && <AreaPage area="block-plans" title="Blockpläne" description="Blockunterricht und Schulwochen des laufenden Schuljahres." note="Blockpläne stehen nur zur Verfügung, wenn deine Schule Unterricht in Blöcken organisiert und die Ansicht freigeschaltet hat." />}
        {activeArea === 'sick' && <SickNotePage />}
        {activeArea === 'files' && <FilesPage />}
        {activeArea === 'classes' && <ClassesPage />}
        {activeArea === 'id-card' && <StudentCardPage demo={demo} />}
      </main>
    </div>
  )
}
