import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SchoolAreaResponse, SchoolOption } from '../../shared/school'
import { getClasses, getClassTimetable } from '../api'
import { addDays, isoDate, mondayOf } from '../date'
import { SchoolTables } from './SchoolTable'

export function ClassesPage() {
  const [options, setOptions] = useState<SchoolOption[]>([])
  const [className, setClassName] = useState('')
  const [start, setStart] = useState(isoDate(mondayOf(new Date())))
  const [data, setData] = useState<SchoolAreaResponse>()
  const [error, setError] = useState('')

  useEffect(() => { getClasses().then(({ options: result }) => setOptions(result)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Klassen konnten nicht geladen werden.')) }, [])
  useEffect(() => {
    if (!className) return
    setError('')
    getClassTimetable(className, start).then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Der Klassenplan konnte nicht geladen werden.'))
  }, [className, start])

  return <div className="content-area"><div className="area-heading"><p className="eyebrow">Andere Klassen</p><h1>Klassenpläne</h1><p>Sieh den Stundenplan einer anderen Klasse für die gewählte Woche ein.</p></div><aside className="area-note"><strong>Ansicht</strong><p>Die Pläne enthalten dieselben Angaben zu Fach, Lehrkraft, Raum und Klausuren wie dein eigener Stundenplan.</p></aside>
    <div className="date-filter class-filter"><label>Klasse<select value={className} onChange={(event) => setClassName(event.target.value)}><option value="">Klasse auswählen</option>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><label>Woche ab<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><div className="class-week-actions" aria-label="Woche wechseln"><button type="button" aria-label="Vorherige Woche" onClick={() => setStart(isoDate(addDays(new Date(`${start}T12:00:00`), -7)))}><ChevronLeft size={18} /></button><button type="button" onClick={() => setStart(isoDate(mondayOf(new Date())))}><CalendarDays size={16} />Aktuelle Woche</button><button type="button" aria-label="Nächste Woche" onClick={() => setStart(isoDate(addDays(new Date(`${start}T12:00:00`), 7)))}><ChevronRight size={18} /></button></div></div>
    {error && <div className="state-card error-state"><p>{error}</p></div>}
    {!className && !error && <div className="empty-area"><strong>Klasse auswählen</strong><p>Danach erscheint der vollständige Wochenplan.</p></div>}
    {data && !error && <SchoolTables tables={data.tables} emptyText="Für diese Klasse wurde in der Woche kein Unterricht gefunden." />}
  </div>
}
