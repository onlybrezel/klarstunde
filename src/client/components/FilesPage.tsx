import { loadError, type LoadError } from '../diagnostics'
import { EmptyState, ErrorState, LoadingState, UnavailableState } from './PageState'
import { useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import type { SchoolFilter, SharedFile } from '../../shared/school'
import { getFiles } from '../api'

export function FilesPage() {
  const [files, setFiles] = useState<SharedFile[]>([])
  const [filters, setFilters] = useState<SchoolFilter[]>([])
  const [area, setArea] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<LoadError>()
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError(undefined)
    getFiles(area).then((value) => { if (active) { setFiles(value.files); setFilters(value.filters); setUnavailable(value.availability === 'unavailable') } }).catch((reason: unknown) => { if (active) setError(loadError(reason, 'Dateien konnten nicht geladen werden.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [area, reload])
  const areaFilter = filters.find((filter) => filter.name === 'LF')
  return <div className="content-area"><div className="area-heading"><p className="eyebrow">Von deiner Schule</p><h1>Dateien</h1><p>Unterlagen, die für deine Klasse freigegeben wurden.</p></div><aside className="area-note"><strong>Freigaben</strong><p>Die Dateien können nach Lernfeld oder Unterrichtsbereich sortiert sein. Es werden nur Freigaben angezeigt, die für deine Klasse bestimmt sind.</p></aside>
    {areaFilter && <div className="date-filter"><label>Bereich<select value={area} onChange={(event) => setArea(event.target.value)}>{areaFilter.options.map((option, index) => <option value={option.value} key={`${option.value}-${index}`}>{option.label}</option>)}</select></label></div>}
    {loading && <LoadingState message="Dateien werden geladen …" />}
    {error && <ErrorState error={error} area="files" onRetry={() => setReload((value) => value + 1)} />}
    {!loading && !error && (unavailable ? <UnavailableState /> : files.length === 0 && <EmptyState title="Keine Freigaben" message="Für den gewählten Bereich wurden keine Dateien geliefert." />)}
    {!loading && !error && !unavailable && <div className="file-list">{files.map((file) => <a href={`/api/files/open?${new URLSearchParams({ href: file.downloadHref })}`} target="_blank" rel="noreferrer" key={file.downloadHref}><span><FileDown /></span><div><strong>{file.name}</strong><p>{file.description || file.area}</p></div></a>)}</div>}
  </div>
}
