import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react'
import { categories, type Category, type FacilityFilters, type FacilityStatus } from '../types'

const categoryKeys = Object.keys(categories) as Category[]
const statuses: FacilityStatus[] = ['Active', 'Maintenance', 'Offline']

type SidebarProps = {
  filters: FacilityFilters
  regions: string[]
  onChange: (filters: FacilityFilters) => void
  onReset: () => void
}

export default function Sidebar({ filters, regions, onChange, onReset }: SidebarProps) {
  function toggleCategory(category: Category) {
    const selected = filters.categories.includes(category)
    onChange({
      ...filters,
      categories: selected
        ? filters.categories.filter((item) => item !== category)
        : [...filters.categories, category],
    })
  }

  function toggleStatus(status: FacilityStatus) {
    const selected = filters.statuses.includes(status)
    onChange({
      ...filters,
      statuses: selected
        ? filters.statuses.filter((item) => item !== status)
        : [...filters.statuses, status],
    })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-title-row">
        <div>
          <p className="eyebrow">EXPLORE DATA</p>
          <h1>Filters</h1>
        </div>
        <span className="filter-icon"><SlidersHorizontal size={17} /></span>
      </div>
      <label className="search-box">
        <Search size={16} />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search facilities..."
          aria-label="Search facilities"
        />
      </label>

      <section className="filter-section">
        <h2>Facility type</h2>
        <div className="filter-options">
          {categoryKeys.map((category) => (
            <label className="check-row" key={category}>
              <input type="checkbox" checked={filters.categories.includes(category)} onChange={() => toggleCategory(category)} />
              <i className="category-dot" style={{ backgroundColor: categories[category].color }} />
              <span>{categories[category].label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="filter-section">
        <h2>Status</h2>
        <div className="filter-options status-options">
          {statuses.map((status) => (
            <label className="check-row" key={status}>
              <input type="checkbox" checked={filters.statuses.includes(status)} onChange={() => toggleStatus(status)} />
              <i className={`status-dot status-${status.toLowerCase()}`} />
              <span>{status}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="filter-section range-filter">
        <div className="range-label"><h2>Maximum risk score</h2><strong>{filters.maxRisk}</strong></div>
        <input type="range" min="0" max="100" value={filters.maxRisk} onChange={(event) => onChange({ ...filters, maxRisk: Number(event.target.value) })} aria-label="Maximum risk score" />
        <div className="range-ends"><span>Low</span><span>High</span></div>
      </section>

      <section className="filter-section range-filter">
        <div className="range-label"><h2>Capacity range</h2><strong>≤ {filters.maxCapacity} u</strong></div>
        <input type="range" min="50" max="300" step="10" value={filters.maxCapacity} onChange={(event) => onChange({ ...filters, maxCapacity: Number(event.target.value) })} aria-label="Maximum capacity" />
        <div className="range-ends"><span>50 units</span><span>300 units</span></div>
      </section>

      <section className="filter-section">
        <h2>Region</h2>
        <div className="region-options">
          <button type="button" className={filters.region === 'all' ? 'region-chip active' : 'region-chip'} onClick={() => onChange({ ...filters, region: 'all' })}>All areas</button>
          {regions.map((region) => (
            <button type="button" className={filters.region === region ? 'region-chip active' : 'region-chip'} key={region} onClick={() => onChange({ ...filters, region })}>{region}</button>
          ))}
        </div>
      </section>

      <button type="button" className="reset-button" onClick={onReset}><RotateCcw size={14} /> Reset all filters</button>
      <p className="sidebar-footnote">Operational attributes are simulated for demonstration. Locations are from OpenStreetMap.</p>
    </aside>
  )
}
