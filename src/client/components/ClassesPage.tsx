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
  const [classError, setClassError] = useState('')
  const [optionsReload, setOptionsReload] = useState(0)
  const [reload, setReload] = useState(0)
  const [shown, setShown] = useState('')

  useEffect(() => {
    let active = true
    setClassError('')
    getClasses().then(({ options: result }) => { if (active) setOptions(result) }).catch((reason: unknown) => { if (active) setClassError(reason instanceof Error ? reason.message : 'Klassen konnten nicht geladen werden.') })
    return () => { active = false }
  }, [optionsReload])
  useEffect(() => {
    setLoading(false)
    setError('')
    if (!className || !isIsoDate(start)) return
    const controller = new AbortController()
    setError('')
    setLoading(true)
    getClassTimetable(className, start, effective, controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setData(result); setShown(`${className} · Woche ab ${new Date(`${start}T12:00:00`).toLocaleDateString('de-DE')}${effective ? ' · Effektiver Plan' : ''}`) } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Der Klassenplan konnte nicht geladen werden.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [className, start, effective, reload])

  return <div className="content-area"><div className="area-heading"><p className="eyebrow">Andere Klassen</p><h1>Klassenpläne</h1><p>Sieh den Stundenplan einer anderen Klasse für die gewählte Woche ein.</p></div><aside className="area-note"><strong>Ansicht</strong><p>Die Pläne enthalten dieselben Angaben zu Fach, Lehrkraft, Raum und Klausuren wie dein eigener Stundenplan.</p></aside>
    <div className="date-filter class-filter"><label>Klasse<select value={className} onChange={(event) => setClassName(event.target.value)}><option value="">Klasse auswählen</option>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><label>Woche ab<input type="date" value={start} onChange={(event) => { if (isIsoDate(event.target.value)) setStart(event.target.value) }} /></label><div className="class-week-actions" aria-label="Woche wechseln"><button type="button" aria-label="Vorherige Woche" onClick={() => setStart(isoDate(addDays(new Date(`${start}T12:00:00`), -7)))}><ChevronLeft size={18} /></button><button type="button" onClick={() => setStart(isoDate(mondayOf(new Date())))}><CalendarDays size={16} />Aktuelle Woche</button><button type="button" aria-label="Nächste Woche" onClick={() => setStart(isoDate(addDays(new Date(`${start}T12:00:00`), 7)))}><ChevronRight size={18} /></button></div></div>
    {classError && <div className="state-card error-state" role="alert"><p>{classError}</p><button onClick={() => setOptionsReload((value) => value + 1)}>Klassen erneut laden</button></div>}
    {error && <div className="state-card error-state" role="alert"><p>{error}</p><button onClick={() => setReload((value) => value + 1)}>Erneut versuchen</button></div>}
    {!className && !classError && <div className="empty-area"><strong>Klasse auswählen</strong><p>Danach erscheint der vollständige Wochenplan.</p></div>}
    <div className="plan-options"><label><input type="checkbox" checked={effective} onChange={(event) => setEffective(event.target.checked)} />Effektiver Plan</label><label><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />Kompakt</label></div>
    {loading && <p role="status">Klassenplan wird geladen …</p>}
    {data && className && <>{(error || loading) && <aside className="stale-plan" role="status"><strong>{error ? 'Letzter geladener Stand · nicht aktuell bestätigt' : 'Wird aktualisiert · bisheriger Stand'}</strong><span>{shown}</span></aside>}<Timetable days={data.days} labels={data.labels} compact={compact} /></>}
  </div>
}
