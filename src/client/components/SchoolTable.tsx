import { Download } from 'lucide-react'
import type { SchoolTable as SchoolTableData } from '../../shared/school'

export function SchoolTables({ tables, emptyText = 'Für diesen Zeitraum gibt es keine Einträge.' }: { tables: SchoolTableData[]; emptyText?: string }) {
  const visible = tables.filter((table) => table.rows.length > 0)
  if (visible.length === 0) return <div className="empty-area"><strong>Alles ruhig</strong><p>{emptyText}</p></div>

  return <div className="table-stack">{visible.map((table, index) => (
    <section className="data-card" key={`${table.title}-${index}`}>
      <h2>{table.title}</h2>
      <div className="data-table-scroll"><table><thead><tr>{table.columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`}>{column || '–'}</th>)}</tr></thead>
        <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => {
          const link = table.links?.[rowIndex]?.[cellIndex]
          return <td key={cellIndex}>{link
            ? <a className="table-download" href={`/api/files/open?${new URLSearchParams({ href: link.href })}`} target="_blank" rel="noreferrer">{cell || link.label || 'Herunterladen'}<Download size={15} aria-hidden="true" /></a>
            : cell || '–'}</td>
        })}</tr>)}</tbody>
      </table></div>
    </section>
  ))}</div>
}
