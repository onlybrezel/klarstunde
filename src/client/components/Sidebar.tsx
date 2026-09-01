import { BellRing, BookOpenCheck, CalendarDays, CircleUserRound, Files, GraduationCap, IdCard, LayoutGrid, LogOut, MessageSquareText, Stethoscope, UsersRound } from 'lucide-react'
import { Brand } from './Brand'

interface SidebarProps {
  demo: boolean
  active: string
  onNavigate: (area: string) => void
  onLogout: () => void
}

const navigation = [
  ['plan', CalendarDays, 'Stundenplan'],
  ['attendance', GraduationCap, 'Fehlzeiten & Noten'],
  ['homework', BookOpenCheck, 'Klassenbuch'],
  ['messages', MessageSquareText, 'Nachrichten'],
  ['notifications', BellRing, 'Benachrichtigungen'],
  ['sick', Stethoscope, 'Krankmeldung'],
  ['files', Files, 'Dateien'],
  ['classes', UsersRound, 'Klassenpläne'],
  ['blocks', LayoutGrid, 'Blockpläne'],
  ['id-card', IdCard, 'Schülerausweis'],
] as const

export function Sidebar({ demo, active, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Hauptnavigation">
        <span className="nav-section">Deine Schule</span>
        {navigation.map(([id, Icon, label], index) => <div key={id}>{index === 6 && <span className="nav-section nav-section-spaced">Weitere Bereiche</span>}<button className={`nav-item ${active === id ? 'active' : ''} ${demo && id !== 'plan' ? 'muted' : ''}`} disabled={demo && id !== 'plan'} onClick={() => onNavigate(id)}><Icon size={19} />{label}</button></div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile"><CircleUserRound size={31} /><div><strong>{demo ? 'Demo-Modus' : 'Schulkonto'}</strong><small>{demo ? 'Beispieldaten' : 'Angemeldet'}</small></div></div>
        <button onClick={onLogout}><LogOut size={18} />{demo ? 'Demo beenden' : 'Abmelden'}</button>
      </div>
    </aside>
  )
}
