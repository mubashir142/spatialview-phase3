import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapView from './MapView'
import { fetchCoverage } from '../data/coverage'
import type { CoverageFeature } from '../data/coverage'
import type { Facility } from '../types'

vi.mock('../data/coverage', () => ({
  fetchCoverage: vi.fn(),
}))

vi.mock('react-leaflet', async () => {
  const React = await import('react')
  return {
    CircleMarker: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    GeoJSON: ({
      data,
      children,
    }: {
      data: CoverageFeature
      children?: React.ReactNode
    }) =>
      React.createElement(
        'div',
        { 'data-testid': `coverage-area-${String(data.id)}` },
        children,
      ),
    MapContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Popup: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    TileLayer: ({ url }: { url: string }) =>
      React.createElement('div', { 'data-testid': 'map-tile-layer', 'data-url': url }),
    Tooltip: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    useMap: () => ({ flyTo: vi.fn(), getZoom: () => 11 }),
  }
})

const facility: Facility = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [73.05, 33.68] },
  properties: {
    id: 'facility-1',
    name: 'Test facility',
    category: 'hospital',
    status: 'Active',
    capacity: 100,
    riskScore: 10,
    region: 'Islamabad area',
    establishedYear: 2000,
    lastInspection: '2025-01-01',
  },
}

const area: CoverageFeature = {
  type: 'Feature',
  id: 'area-1',
  geometry: {
    type: 'Polygon',
    coordinates: [[[73, 33], [73.1, 33], [73.1, 33.1], [73, 33.1], [73, 33]]],
  },
  properties: {
    name: 'Sector G-6',
    areaType: 'sector',
    radiusMeters: 1500,
    category: 'hospital',
    totalAreaKm2: 4,
    coveredAreaKm2: 3.2,
    coveragePercent: 80,
  },
}

function renderMapView() {
  return render(
    <InteractiveMapView />,
  )
}

function InteractiveMapView() {
  const [basemap, setBasemap] = useState<'light' | 'dark'>('light')
  return (
    <MapView
      facilities={[facility]}
      selectedId={null}
      hoveredId={null}
      onSelect={vi.fn()}
      onHover={vi.fn()}
      basemap={basemap}
      onBasemapChange={setBasemap}
    />
  )
}

describe('MapView coverage controls', () => {
  beforeEach(() => {
    vi.mocked(fetchCoverage).mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requests and displays coverage when enabled', async () => {
    vi.mocked(fetchCoverage).mockResolvedValue([area])
    renderMapView()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Coverage' }))

    expect(await screen.findByTestId('coverage-area-area-1')).toBeInTheDocument()
    expect(screen.getByText(
      'Sector G-6: 80.0% covered (3.20 of 4.00 km²)',
    )).toBeInTheDocument()
    expect(screen.getByLabelText('Coverage color legend')).toBeInTheDocument()
    expect(fetchCoverage).toHaveBeenCalledWith(1500, 'all', expect.any(AbortSignal))
  })

  it('refetches coverage when radius and category change', async () => {
    vi.mocked(fetchCoverage).mockResolvedValue([])
    renderMapView()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Coverage' }))

    fireEvent.change(screen.getByRole('combobox', { name: 'Coverage service radius' }), {
      target: { value: '3000' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Coverage facility type' }), {
      target: { value: 'park' },
    })

    await waitFor(() => {
      expect(fetchCoverage).toHaveBeenLastCalledWith(
        3000,
        'park',
        expect.any(AbortSignal),
      )
    })
  })

  it('uses visible dark basemap tiles and labels in dark map mode', async () => {
    renderMapView()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Dark' }))

    await waitFor(() => {
      const layers = screen.getAllByTestId('map-tile-layer')
      expect(layers).toHaveLength(2)
      expect(layers[0]).toHaveAttribute(
        'data-url',
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      )
      expect(layers[1]).toHaveAttribute(
        'data-url',
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      )
    })
  })

  it('shows a coverage error and retries on request', async () => {
    vi.mocked(fetchCoverage)
      .mockRejectedValueOnce(new Error('Coverage request failed (503)'))
      .mockResolvedValueOnce([area])
    renderMapView()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Coverage' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Coverage request failed (503)',
    )
    await user.click(screen.getByRole('button', { name: 'Retry coverage request' }))

    expect(await screen.findByTestId('coverage-area-area-1')).toBeInTheDocument()
    expect(fetchCoverage).toHaveBeenCalledTimes(2)
  })
})
