import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { SchoolAreaResponse, SchoolFilter } from '../../shared/school'
import { addDays, isoDate, mondayOf } from '../date'
import { getSchoolArea, getSimpleArea } from '../api'
import { SchoolTables } from './SchoolTable'

interface AreaPageProps {
  area: 'attendance' | 'homework' | 'messages' | 'block-plans'
  title: string
  description: string
  note: string
}

const filterLabels: Record<string, string> = {
  Kurs: 'Kurs', Fach: 'Fach', Raum: 'Raum', LK: 'Lehrkraft',
  vonTag: 'Wochentag von', bisTag: 'Wochentag bis', vonh: 'Stunde von', bish: 'Stunde bis',
  SJ: 'Zeugniszeitraum', Schuljahr: 'Schuljahr',
}

function semesterRange(today: Date): [string, string] {
  const year = today.getFullYear()
  return today.getMonth() < 7
    ? [isoDate(new Date(year, 1, 1)), isoDate(new Date(year, 6, 31))]
    : [isoDate(new Date(year, 7, 1)), isoDate(new Date(year + 1, 0, 31))]
}

function visibleFilters(filters: SchoolFilter[], area: AreaPageProps['area']): SchoolFilter[] {
  const allowed = area === 'attendance' ? ['SJ']
    : area === 'homework' ? ['Kurs', 'Fach', 'Raum', 'LK', 'vonTag', 'bisTag', 'vonh', 'bish']
      : area === 'block-plans' ? ['Schuljahr'] : []
  return filters.filter((filter) => allowed.includes(filter.name))
}

export function AreaPage({ area, title, description, note }: AreaPageProps) {
  const today = new Date()
  const [from, setFrom] = useState(() => isoDate(addDays(today, area === 'homework' ? -30 : -180)))
  const [until, setUntil] = useState(() => isoDate(addDays(today, area === 'homework' || area === 'attendance' ? 180 : 0)))
  const [filters, setFilters] = useState<Record<string, string>>((): Record<string, string> => area === 'block-plans' ? { Schuljahr: String(today.getFullYear()) } : {})
  const [onlyAbsences, setOnlyAbsences] = useState(false)
  const [data, setData] = useState<SchoolAreaResponse>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const promise = area === 'attendance' || area === 'homework'
      ? getSchoolArea(area, from, until, filters, onlyAbsences)
      : getSimpleArea(area, filters)
    promise.then((value) => { if (active) setData(value) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Der Bereich konnte nicht geladen werden.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [area, filters, from, onlyAbsences, until])

  function setRange(start: Date, end: Date) {
    setFrom(isoDate(start))
    setUntil(isoDate(end))
  }

  const availableFilters = visibleFilters(data?.filters ?? [], area)
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (onlyAbsences ? 1 : 0)

  return <div className="content-area">
    <div className="area-heading"><p className="eyebrow">Schulübersicht</p><h1>{title}</h1><p>{description}</p></div>
    <aside className="area-note"><strong>Gut zu wissen</strong><p>{note}</p></aside>

    {(area === 'attendance' || area === 'homework') && <div className="filter-panel">
      <div className="range-shortcuts" aria-label="Zeitraum auswählen">
        <button type="button" onClick={() => setRange(today, today)}>Heute</button>
        <button type="button" onClick={() => { const monday = mondayOf(today); setRange(monday, addDays(monday, 6)) }}>Diese Woche</button>
        <button type="button" onClick={() => setRange(today, addDays(today, 27))}>4 Wochen</button>
        <button type="button" onClick={() => { const [start, end] = semesterRange(today); setFrom(start); setUntil(end) }}>Halbjahr</button>
      </div>
      <div className="date-filter"><label>Von<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Bis<input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label></div>
    </div>}

    {area === 'block-plans' && availableFilters.map((filter) => <div className="date-filter" key={filter.name}><label>Schuljahr<select value={filters[filter.name] ?? ''} onChange={(event) => setFilters({ [filter.name]: event.target.value })}>{filter.options.map((option, index) => <option value={option.value} key={`${option.value}-${index}`}>{option.label}</option>)}</select></label></div>)}

    {area !== 'block-plans' && (availableFilters.length > 0 || area === 'attendance') && <details className="advanced-filters">
      <summary><SlidersHorizontal size={17} /> Filter {activeFilterCount > 0 && <span>{activeFilterCount}</span>}</summary>
      <div className="filter-grid">
        {availableFilters.map((filter) => <label key={filter.name}>{filterLabels[filter.name] ?? filter.name}<select value={filters[filter.name] ?? ''} onChange={(event) => setFilters((current) => ({ ...current, [filter.name]: event.target.value }))}>{filter.options.map((option, index) => <option value={option.value} key={`${option.value}-${index}`}>{option.label}</option>)}</select></label>)}
        {area === 'attendance' && <label className="check-filter"><input type="checkbox" checked={onlyAbsences} onChange={(event) => setOnlyAbsences(event.target.checked)} />Nur Fehlzeiten anzeigen</label>}
      </div>
      {activeFilterCount > 0 && <button className="reset-filters" type="button" onClick={() => { setFilters({}); setOnlyAbsences(false) }}>Filter zurücksetzen</button>}
    </details>}

    {loading && <div className="area-loading">Daten werden geladen …</div>}
    {error && <div className="state-card error-state"><strong>Nicht verfügbar</strong><p>{error}</p></div>}
    {!loading && !error && data && <><div className="notice-stack">{data.notices.map((notice, index) => <article key={index}><strong>{notice.title}</strong><p>{notice.body}</p></article>)}</div><SchoolTables tables={data.tables} /></>}
  </div>
}
