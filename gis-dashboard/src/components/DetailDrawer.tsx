import { X, ExternalLink, MapPin, CalendarDays, Gauge, Zap } from 'lucide-react'
import type { Facility, Category } from '../types'
import { categories } from '../types'

type DetailDrawerProps = {
  facility: Facility | null
  onClose: () => void
}

export default function DetailDrawer({ facility, onClose }: DetailDrawerProps) {
  if (!facility) return null
  const { properties } = facility
  const category = properties.category as Category

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-header">
          <div><p className="eyebrow">FACILITY PROFILE</p><span className={`status-pill ${properties.status.toLowerCase()}`}><i />{properties.status}</span></div>
          <button type="button" className="icon-button" aria-label="Close details" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="drawer-title">
          <span className="drawer-category-icon" style={{ color: categories[category].color, backgroundColor: `${categories[category].color}1c` }}><MapPin size={20} /></span>
          <div><h2 id="drawer-title">{properties.name}</h2><p>{categories[category].label}</p></div>
        </div>
        <div className="drawer-metrics">
          <div><Gauge size={16} /><span>Risk score</span><strong>{properties.riskScore}<small> / 100</small></strong></div>
          <div><Zap size={16} /><span>Capacity</span><strong>{properties.capacity}<small> units</small></strong></div>
        </div>
        <section className="drawer-section">
          <h3>Asset information</h3>
          <dl>
            <div><dt>Facility ID</dt><dd>{properties.id}</dd></div>
            <div><dt>Region</dt><dd>{properties.region}</dd></div>
            <div><dt>Established</dt><dd>{properties.establishedYear}</dd></div>
            <div><dt>Last inspection</dt><dd><CalendarDays size={13} />{properties.lastInspection}</dd></div>
            <div><dt>Coordinates</dt><dd>{facility.geometry.coordinates[1].toFixed(5)}, {facility.geometry.coordinates[0].toFixed(5)}</dd></div>
          </dl>
        </section>
        <div className="simulated-note">Risk, capacity, status, establishment, and inspection fields are simulated demo values, not verified asset records.</div>
        {properties.sourceUrl && <a className="source-link" href={properties.sourceUrl} target="_blank" rel="noreferrer">View source location <ExternalLink size={14} /></a>}
      </aside>
    </div>
  )
}
