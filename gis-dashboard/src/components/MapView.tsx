import { useEffect, useState } from 'react'
import { AlertTriangle, Layers, LoaderCircle, Map as MapIcon, RefreshCw } from 'lucide-react'
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { PathOptions } from 'leaflet'
import { fetchCoverage } from '../data/coverage'
import type { CoverageFeature } from '../data/coverage'
import type { Facility, Category } from '../types'
import { categories } from '../types'

type MapViewProps = {
  facilities: Facility[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (facility: Facility) => void
  onHover: (id: string | null) => void
  basemap: 'light' | 'dark'
  onBasemapChange: (basemap: 'light' | 'dark') => void
}

function MapFocus({ facility }: { facility?: Facility }) {
  const map = useMap()
  useEffect(() => {
    if (facility) {
      const [longitude, latitude] = facility.geometry.coordinates
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 14), { duration: 0.65 })
    }
  }, [facility, map])
  return null
}

function displayName(facility: Facility) {
  return facility.properties.name || 'Unnamed facility'
}

const coverageRadii = [500, 1000, 1500, 3000, 5000]

function isCategory(value: string): value is Category {
  return Object.prototype.hasOwnProperty.call(categories, value)
}

function coverageStyle(percent: number): PathOptions {
  const color = percent >= 80 ? '#27875b' : percent >= 50 ? '#d39a2c' : '#d65353'
  return {
    color,
    weight: 2,
    fillColor: color,
    fillOpacity: 0.24,
  }
}

export default function MapView({
  facilities,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  basemap,
  onBasemapChange,
}: MapViewProps) {
  const selected = facilities.find((facility) => facility.properties.id === selectedId)
  const [coverageEnabled, setCoverageEnabled] = useState(false)
  const [coverageRadius, setCoverageRadius] = useState(1500)
  const [coverageCategory, setCoverageCategory] = useState<Category | 'all'>('all')
  const [coverageFeatures, setCoverageFeatures] = useState<CoverageFeature[]>([])
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [coverageError, setCoverageError] = useState<string | null>(null)
  const [coverageRetry, setCoverageRetry] = useState(0)

  useEffect(() => {
    if (!coverageEnabled) return

    const controller = new AbortController()
    setCoverageLoading(true)
    setCoverageError(null)
    fetchCoverage(coverageRadius, coverageCategory, controller.signal)
      .then(setCoverageFeatures)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('Unable to load service coverage.', error)
        setCoverageError(
          error instanceof Error ? error.message : 'Coverage data could not be loaded.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setCoverageLoading(false)
      })

    return () => controller.abort()
  }, [coverageEnabled, coverageRadius, coverageCategory, coverageRetry])

  return (
    <section className="map-panel" aria-label="Facility map">
      <div className="map-header">
        <div>
          <p className="eyebrow">GEOSPATIAL VIEW</p>
          <h2>Islamabad service network</h2>
        </div>
        <div className="map-header-actions">
          <button
            type="button"
            className={`coverage-toggle${coverageEnabled ? ' active' : ''}`}
            aria-pressed={coverageEnabled}
            onClick={() => setCoverageEnabled((enabled) => !enabled)}
          >
            Coverage
          </button>
          <div className="map-switcher" aria-label="Basemap style">
            <button type="button" className={basemap === 'light' ? 'active' : ''} onClick={() => onBasemapChange('light')}><MapIcon size={14} /> Streets</button>
            <button type="button" className={basemap === 'dark' ? 'active' : ''} onClick={() => onBasemapChange('dark')}><Layers size={14} /> Dark</button>
          </div>
        </div>
      </div>
      {coverageEnabled && (
        <div className="coverage-controls">
          <label>
            Service radius
            <select
              aria-label="Coverage service radius"
              value={coverageRadius}
              onChange={(event) => setCoverageRadius(Number(event.target.value))}
            >
              {coverageRadii.map((radius) => (
                <option key={radius} value={radius}>{radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}</option>
              ))}
            </select>
          </label>
          <label>
            Facility type
            <select
              aria-label="Coverage facility type"
              value={coverageCategory}
              onChange={(event) => {
                const value = event.target.value
                if (value === 'all' || isCategory(value)) setCoverageCategory(value)
              }}
            >
              <option value="all">All services</option>
              {(Object.keys(categories) as Category[]).map((category) => (
                <option key={category} value={category}>{categories[category].label}</option>
              ))}
            </select>
          </label>
          {coverageLoading && <span role="status"><LoaderCircle size={13} className="spin" /> Updating coverage</span>}
          {coverageError && (
            <span className="coverage-error" role="alert">
              <AlertTriangle size={13} /> {coverageError}
              <button
                type="button"
                aria-label="Retry coverage request"
                onClick={() => setCoverageRetry((count) => count + 1)}
              >
                <RefreshCw size={12} />
              </button>
            </span>
          )}
          {!coverageLoading && !coverageError && coverageFeatures.length === 0 && (
            <span>No administrative areas found. Load boundary polygons to analyze coverage.</span>
          )}
          {!coverageLoading && !coverageError && coverageFeatures.length > 0 && (
            <span className="coverage-legend" aria-label="Coverage color legend">
              <i className="high" /> 80–100%
              <i className="medium" /> 50–79%
              <i className="low" /> under 50%
            </span>
          )}
        </div>
      )}
      <div className="map-canvas">
        <MapContainer center={[33.6844, 73.0479]} zoom={11} minZoom={9} maxZoom={18} scrollWheelZoom className="leaflet-map">
          <TileLayer
            key={basemap}
            attribution={basemap === 'dark'
              ? 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
            url={basemap === 'dark'
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
          />
          {basemap === 'dark' && (
            <TileLayer
              attribution="Labels &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            />
          )}
          <MapFocus facility={selected} />
          {coverageEnabled && coverageFeatures.map((feature) => (
            <GeoJSON
              key={String(feature.id)}
              data={feature}
              style={() => coverageStyle(feature.properties.coveragePercent)}
            >
              <Tooltip sticky>
                {feature.properties.name}: {feature.properties.coveragePercent.toFixed(1)}% covered
                ({feature.properties.coveredAreaKm2.toFixed(2)} of {feature.properties.totalAreaKm2.toFixed(2)} km²)
              </Tooltip>
            </GeoJSON>
          ))}
          {facilities.map((facility) => {
            const [longitude, latitude] = facility.geometry.coordinates
            const id = facility.properties.id
            const category = facility.properties.category as Category
            const isEmphasized = id === selectedId || id === hoveredId
            return (
              <CircleMarker
                key={id}
                center={[latitude, longitude]}
                radius={isEmphasized ? 10 : 6}
                pathOptions={{
                  color: isEmphasized ? '#ffffff' : categories[category].color,
                  weight: isEmphasized ? 3 : 1.5,
                  fillColor: categories[category].color,
                  fillOpacity: 0.88,
                }}
                eventHandlers={{
                  click: () => onSelect(facility),
                  mouseover: () => onHover(id),
                  mouseout: () => onHover(null),
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <strong>{displayName(facility)}</strong>
                    <span>{categories[category].label} · {facility.properties.status}</span>
                    <button type="button" onClick={() => onSelect(facility)}>View facility details</button>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
        <div className="map-legend">
          <strong>Facility type</strong>
          {(Object.keys(categories) as Category[]).map((category) => (
            <span key={category}><i style={{ backgroundColor: categories[category].color }} />{categories[category].label}</span>
          ))}
        </div>
      </div>
      <div className="map-footer">
        <span><i className="live-dot" /> OpenStreetMap locations · simulated operational data</span>
        <span>Pan to move · Scroll to zoom</span>
      </div>
    </section>
  )
}
