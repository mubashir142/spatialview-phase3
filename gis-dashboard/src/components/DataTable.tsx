import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import type { Facility, Category } from '../types'
import { categories } from '../types'

type SortKey = 'name' | 'category' | 'status' | 'riskScore' | 'capacity'
type DataTableProps = {
  facilities: Facility[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (facility: Facility) => void
  onHover: (id: string | null) => void
}

function riskLabel(score: number) {
  if (score >= 70) return 'High'
  if (score >= 40) return 'Moderate'
  return 'Low'
}

export default function DataTable({ facilities, selectedId, hoveredId, onSelect, onHover }: DataTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [ascending, setAscending] = useState(true)
  const [page, setPage] = useState(0)
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const pageSize = 10
  const sorted = useMemo(() => [...facilities].sort((first, second) => {
    const a = first.properties[sortKey]
    const b = second.properties[sortKey]
    const result = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b))
    return ascending ? result : -result
  }), [ascending, facilities, sortKey])
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageItems = sorted.slice(page * pageSize, (page + 1) * pageSize)

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1))
  }, [pageCount])

  useEffect(() => {
    if (!selectedId) return
    const row = rowRefs.current.get(selectedId)
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      const selectedIndex = sorted.findIndex((facility) => facility.properties.id === selectedId)
      if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize))
    }
  }, [selectedId, sorted])

  function changeSort(key: SortKey) {
    if (sortKey === key) setAscending((current) => !current)
    else {
      setSortKey(key)
      setAscending(true)
    }
    setPage(0)
  }

  function sortButton(key: SortKey, label: string) {
    const active = sortKey === key
    return (
      <button type="button" className="sort-button" onClick={() => changeSort(key)}>
        {label}{active && (ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    )
  }

  return (
    <section className="table-panel">
      <div className="table-heading">
        <div><p className="eyebrow">ASSET DIRECTORY</p><h2>Facilities</h2></div>
        <span className="table-count">{facilities.length.toLocaleString()} records</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr>
            <th>{sortButton('name', 'Facility')}</th>
            <th>{sortButton('category', 'Type')}</th>
            <th>{sortButton('status', 'Status')}</th>
            <th>{sortButton('riskScore', 'Risk')}</th>
            <th>{sortButton('capacity', 'Capacity')}</th>
            <th>Region</th>
          </tr></thead>
          <tbody>
            {pageItems.map((facility) => {
              const { properties } = facility
              const category = properties.category as Category
              return (
                <tr
                  key={properties.id}
                  ref={(element) => {
                    if (element) rowRefs.current.set(properties.id, element)
                    else rowRefs.current.delete(properties.id)
                  }}
                  className={`${selectedId === properties.id ? 'selected-row ' : ''}${hoveredId === properties.id ? 'hovered-row' : ''}`}
                  onMouseEnter={() => onHover(properties.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(facility)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(facility)
                    }
                  }}
                  aria-label={`Select ${properties.name}`}
                >
                  <td><div className="facility-name"><i style={{ backgroundColor: categories[category].color }} /><span>{properties.name}</span></div></td>
                  <td><span className="type-pill">{categories[category].label}</span></td>
                  <td><span className={`status-pill ${properties.status.toLowerCase()}`}><i />{properties.status}</span></td>
                  <td><span className={`risk-value ${riskLabel(properties.riskScore).toLowerCase()}`}>{properties.riskScore}<small> / 100</small></span></td>
                  <td>{properties.capacity} <span className="unit-muted">units</span></td>
                  <td><span className="region-cell"><MapPin size={12} />{properties.region}</span></td>
                </tr>
              )
            })}
            {pageItems.length === 0 && <tr><td colSpan={6} className="no-results">No facilities match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <span>Showing {sorted.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}</span>
        <div>
          <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /></button>
          <span>Page {page + 1} of {pageCount}</span>
          <button type="button" aria-label="Next page" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}><ChevronRight size={16} /></button>
        </div>
      </div>
    </section>
  )
}
