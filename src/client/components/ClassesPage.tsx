import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SchoolOption } from '../../shared/school'
import type { TimetableResponse } from '../../shared/timetable'
import { isIsoDate } from '../../shared/date'
import { getClasses, getClassTimetable } from '../api'
import { addDays, isoDate, mondayOf } from '../date'
import { Timetable } from './Timetable'

export function ClassesPage() {
  const [options, setOptions] = useState<SchoolOption[]>([])
  const [className, setClassName] = useState('')
  const [start, setStart] = useState(isoDate(mondayOf(new Date())))
  const [data, setData] = useState<TimetableResponse>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [effective, setEffective] = useState(false)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    let active = true
    getClasses().then(({ options: result }) => { if (active) setOptions(result) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Klassen konnten nicht geladen werden.') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    setData(undefined)
    setLoading(false)
    setError('')
    if (!className || !isIsoDate(start)) return
    const controller = new AbortController()
    setError('')
    setLoading(true)
    getClassTimetable(className, start, effective, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setData(result) })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Der Klassenplan konnte nicht geladen werden.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [className, start, effective])

  return <div className="content-area"><div className="area-heading"><p className="eyebrow">Andere Klassen</p><h1>Klassenpläne</h1><p>Sieh den Stundenplan einer anderen Klasse für die gewählte Woche ein.</p></div><aside className="area-note"><strong>Ansicht</strong><p>Die Pläne enthalten dieselben Angaben zu Fach, Lehrkraft, Raum und Klausuren wie dein eigener Stundenplan.</p></aside>
    <div className="date-filter class-filter"><label>Klasse<select value={className} onChange={(event) => setClassName(event.target.value)}><option value="">Klasse auswählen</option>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><label>Woche ab<input type="date" value={start} onChange={(event) => { if (isIsoDate(event.target.value)) setStart(event.target.value) }} /></label><div className="class-week-actions" aria-label="Woche wechseln"><button type="button" aria-label="Vorherige Woche" onClick={() => setStart(isoDate(addDays(new Date(`${start}T12:00:00`), -7)))}><ChevronLeft size={18} /></button><button type="button" onClick={() => setStart(isoDate(mondayOf(new Date())))}><CalendarDays size={16} />Aktuelle Woche</button><button type="button" aria-label="Nächste Woche" onClick={() => setStart(isoDate(addDays(new Date(`${start}T12:00:00`), 7)))}><ChevronRight size={18} /></button></div></div>
    {error && <div className="state-card error-state"><p>{error}</p></div>}
    {!className && !error && <div className="empty-area"><strong>Klasse auswählen</strong><p>Danach erscheint der vollständige Wochenplan.</p></div>}
    <div className="plan-options"><label><input type="checkbox" checked={effective} onChange={(event) => setEffective(event.target.checked)} />Effektiver Plan</label><label><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />Kompakt</label></div>
    {loading && <p role="status">Klassenplan wird geladen …</p>}
    {data && !error && !loading && <Timetable days={data.days} labels={data.labels} compact={compact} />}
  </div>
}
