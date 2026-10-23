import { Download, Layers3 } from 'lucide-react'

type HeaderProps = {
  total: number
  active: number
  onExport: () => void
}

export default function Header({
  total,
  active,
  onExport,
}: HeaderProps) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="SpatialView home">
        <span className="brand-mark"><Layers3 size={19} strokeWidth={2.2} /></span>
        <span className="brand-copy">
          <strong>Spatial<span>View</span></strong>
          <small>ISLAMABAD SERVICES</small>
        </span>
      </a>
      <div className="header-context">
        <span className="header-context-label">FACILITY DIRECTORY</span>
        <strong>Mapped services and coverage</strong>
      </div>
      <div className="topbar-actions">
        <span className="live-indicator"><i /> Live dataset</span>
        <span className="header-count">{active.toLocaleString()} active / {total.toLocaleString()}</span>
        <button
          className="export-button"
          type="button"
          aria-label="Export filtered facilities as CSV"
          onClick={onExport}
        >
          <Download size={15} /> <span>Export</span>
        </button>
      </div>
    </header>
  )
}
