import { useState } from 'react'
import { BookOpen, Menu, X } from 'lucide-react'
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
}

export function Dashboard({ demo, onLogout }: DashboardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeArea, setActiveArea] = useState('plan')
  return (
    <div className="app-shell">
      <div id="mobile-navigation" className={`mobile-drawer ${menuOpen ? 'open' : ''}`}><Sidebar demo={demo} active={activeArea} onNavigate={(area) => { setActiveArea(area); setMenuOpen(false) }} onLogout={onLogout} /></div>
      {menuOpen && <button className="drawer-backdrop" aria-label="Menü schließen" onClick={() => setMenuOpen(false)} />}
      <div className="desktop-sidebar"><Sidebar demo={demo} active={activeArea} onNavigate={setActiveArea} onLogout={onLogout} /></div>
      <main className="dashboard" id="plan">
        <header className="topbar">
          <button className="mobile-menu" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
          <span className="topbar-context"><BookOpen size={16} />Deine Schulübersicht</span>
          <div className="topbar-date"><span>{new Date().toLocaleDateString('de-DE', { weekday: 'long' })}</span>{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </header>

        {activeArea === 'plan' && <PlanPage demo={demo} />}
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
