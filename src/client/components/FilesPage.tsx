import { useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import type { SchoolFilter, SharedFile } from '../../shared/school'
import { getFiles } from '../api'

export function FilesPage() {
  const [files, setFiles] = useState<SharedFile[]>([])
  const [filters, setFilters] = useState<SchoolFilter[]>([])
  const [area, setArea] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true); setError('')
    getFiles(area).then((value) => { setFiles(value.files); setFilters(value.filters) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Dateien konnten nicht geladen werden.')).finally(() => setLoading(false))
  }, [area])
  const areaFilter = filters.find((filter) => filter.name === 'LF')
  return <div className="content-area"><div className="area-heading"><p className="eyebrow">Von deiner Schule</p><h1>Dateien</h1><p>Unterlagen, die für deine Klasse freigegeben wurden.</p></div><aside className="area-note"><strong>Freigaben</strong><p>Die Dateien können nach Lernfeld oder Unterrichtsbereich sortiert sein. Es werden nur Freigaben angezeigt, die für deine Klasse bestimmt sind.</p></aside>
    {areaFilter && <div className="date-filter"><label>Bereich<select value={area} onChange={(event) => setArea(event.target.value)}>{areaFilter.options.map((option, index) => <option value={option.value} key={`${option.value}-${index}`}>{option.label}</option>)}</select></label></div>}
    {loading && <div className="area-loading">Dateien werden geladen …</div>}
    {error && <div className="state-card error-state"><p>{error}</p></div>}
    {!loading && !error && files.length === 0 && <div className="empty-area"><strong>Keine Freigaben</strong><p>Für diese Auswahl sind derzeit keine Dateien hinterlegt.</p></div>}
    {!loading && <div className="file-list">{files.map((file) => <a href={`/api/files/open?${new URLSearchParams({ href: file.downloadHref })}`} target="_blank" rel="noreferrer" key={file.downloadHref}><span><FileDown /></span><div><strong>{file.name}</strong><p>{file.description || file.area}</p></div></a>)}</div>}
  </div>
}
