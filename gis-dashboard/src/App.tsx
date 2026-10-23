import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import AnalyticsPanel from './components/AnalyticsPanel'
import DataTable from './components/DataTable'
import DetailDrawer from './components/DetailDrawer'
import Header from './components/Header'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { fetchFacilities } from './data/facilities'
import type { Facility, FacilityFilters } from './types'
import './App.css'

const initialFilters: FacilityFilters = {
  search: '',
  categories: ['hospital', 'university', 'park', 'public-office'],
  statuses: ['Active', 'Maintenance', 'Offline'],
  maxRisk: 100,
  maxCapacity: 300,
  region: 'all',
}

function csvValue(value: string | number): string {
  const safeValue = String(value).replace(/^[=+\-@\t\r]/, "'$&")
  return `"${safeValue.replaceAll('"', '""')}"`
}

export default function App() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [filters, setFilters] = useState<FacilityFilters>(initialFilters)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [basemap, setBasemap] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchFacilities(controller.signal)
      .then(setFacilities)
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        console.error('Unable to load facility data.', loadError)
        setError(loadError instanceof Error ? loadError.message : 'Facility data could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [retryCount])

  const filteredFacilities = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase()
    return facilities.filter(({ properties }) => {
      const matchesSearch =
        !search ||
        `${properties.name} ${properties.id} ${properties.region}`
          .toLocaleLowerCase()
          .includes(search)
      return (
        matchesSearch &&
        filters.categories.includes(properties.category) &&
        filters.statuses.includes(properties.status) &&
        properties.riskScore <= filters.maxRisk &&
        properties.capacity <= filters.maxCapacity &&
        (filters.region === 'all' || properties.region === filters.region)
      )
    })
  }, [facilities, filters])

  const selectedFacility = facilities.find(
    (facility) => facility.properties.id === selectedId,
  ) ?? null
  const regions = useMemo(
    () => [...new Set(facilities.map((facility) => facility.properties.region))].sort(),
    [facilities],
  )
  const activeCount = facilities.filter(
    (facility) => facility.properties.status === 'Active',
  ).length

  useEffect(() => {
    if (selectedId && !filteredFacilities.some((facility) => facility.properties.id === selectedId)) {
      setSelectedId(null)
    }
  }, [filteredFacilities, selectedId])

  function exportFacilities() {
    const columns = ['id', 'name', 'category', 'status', 'capacity', 'riskScore', 'region', 'establishedYear', 'lastInspection']
    const rows = filteredFacilities.map(({ properties }) =>
      columns.map((column) => csvValue(properties[column as keyof typeof properties] ?? '')).join(','),
    )
    const content = [columns.join(','), ...rows].join('\r\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'spatialview-facilities.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-shell">
      <Header
        total={facilities.length}
        active={activeCount}
        onExport={exportFacilities}
      />
      <div className="app-layout">
        <Sidebar
          filters={filters}
          regions={regions}
          onChange={setFilters}
          onReset={() => setFilters(initialFilters)}
        />
        <div className="dashboard-content">
          <div className="page-intro">
            <div><p className="eyebrow">FACILITIES <span> / </span> ISLAMABAD</p><h1>Service locations</h1><p>Find local services and see which areas they reach.</p></div>
            <div className="refresh-status">
              {loading ? <LoaderCircle size={15} className="spin" /> : <i className={`live-dot${error ? ' error' : ''}`} />}
              {loading ? 'Syncing dataset' : error ? 'Data unavailable' : 'Dataset synced'}
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={17} />
              <span><strong>Could not load facility data.</strong> {error}</span>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}><RefreshCw size={14} /> Retry</button>
            </div>
          )}

          <AnalyticsPanel facilities={filteredFacilities} />
          <div className="explore-grid">
            <MapView
              facilities={filteredFacilities}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={(facility) => setSelectedId(facility.properties.id)}
              onHover={setHoveredId}
              basemap={basemap}
              onBasemapChange={setBasemap}
            />
            <section className="table-section">
              <DataTable
                facilities={filteredFacilities}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={(facility) => setSelectedId(facility.properties.id)}
                onHover={setHoveredId}
              />
            </section>
          </div>
          <footer className="dashboard-footer">© OpenStreetMap contributors. Locations are community-mapped; operational attributes are simulated for demonstration only.</footer>
        </div>
      </div>
      {loading && facilities.length === 0 && <div className="loading-overlay" role="status"><LoaderCircle size={28} className="spin" /><strong>Loading spatial data</strong><span>Connecting to the facility dataset…</span></div>}
      <DetailDrawer facility={selectedFacility} onClose={() => setSelectedId(null)} />
    </main>
  )
}
