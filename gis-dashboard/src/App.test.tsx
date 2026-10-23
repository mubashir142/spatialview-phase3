import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Category, Facility, FacilityStatus } from './types'
import { fetchFacilities } from './data/facilities'

vi.mock('./data/facilities', () => ({
  fetchFacilities: vi.fn(),
}))

vi.mock('./components/MapView', () => ({
  default: ({
    facilities,
    selectedId,
    onSelect,
  }: {
    facilities: Facility[]
    selectedId: string | null
    onSelect: (facility: Facility) => void
  }) => (
    <section aria-label="Facility map">
      <span data-testid="map-facility-count">{facilities.length}</span>
      {facilities.map((facility) => (
        <button
          key={facility.properties.id}
          type="button"
          aria-label={`Map marker ${facility.properties.name}`}
          aria-pressed={selectedId === facility.properties.id}
          onClick={() => onSelect(facility)}
        >
          {facility.properties.name}
        </button>
      ))}
    </section>
  ),
}))

function makeFacility(
  index: number,
  overrides: Partial<Facility['properties']> = {},
): Facility {
  const categories: Category[] = ['park', 'hospital', 'university', 'public-office']
  const statuses: FacilityStatus[] = ['Active', 'Maintenance', 'Offline']
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [73 + index / 100, 33 + index / 100] },
    properties: {
      id: `facility-${index}`,
      name: `Facility ${String(index).padStart(2, '0')}`,
      category: categories[index % categories.length]!,
      status: statuses[index % statuses.length]!,
      capacity: 50 + index * 10,
      riskScore: Math.min(100, index * 5),
      region: index % 2 ? 'North' : 'South',
      establishedYear: 2000 + index,
      lastInspection: '2025-01-15',
      ...overrides,
    },
  }
}

const sampleFacilities = Array.from({ length: 23 }, (_, index) =>
  makeFacility(index, { name: index === 0 ? 'Central Park' : `Facility ${String(index).padStart(2, '0')}` }),
)

function resolveFacilities() {
  vi.mocked(fetchFacilities).mockResolvedValue(sampleFacilities)
}

describe('SpatialView dashboard', () => {
  beforeEach(() => {
    vi.mocked(fetchFacilities).mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:spatialview-export'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('shows loading, then synchronizes the filtered subset across analytics, map, and table', async () => {
    let completeRequest!: (facilities: Facility[]) => void
    vi.mocked(fetchFacilities).mockReturnValue(
      new Promise((resolve) => {
        completeRequest = resolve
      }),
    )
    render(<App />)
    expect(screen.getByText('Loading spatial data')).toBeInTheDocument()

    completeRequest(sampleFacilities)
    expect(await screen.findByText('Dataset synced')).toBeInTheDocument()
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('23')

    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Search facilities' }), 'Central Park')
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('1')
    expect(screen.getByText('1 records')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Central Park/ })).toBeInTheDocument()
    expect(screen.queryByText('Facility 01')).not.toBeInTheDocument()
  })

  it('opens details from a marker and selects the matching table row', async () => {
    resolveFacilities()
    render(<App />)

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Map marker Central Park' }))

    expect(screen.getByRole('dialog', { name: 'Central Park' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Central Park/ })).toHaveClass('selected-row')
  })

  it('opens details from a table row and keeps map selection synchronized', async () => {
    resolveFacilities()
    render(<App />)

    await userEvent.setup().click(await screen.findByRole('row', { name: /Central Park/ }))

    expect(screen.getByRole('dialog', { name: 'Central Park' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Map marker Central Park' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('moves the table to a selected marker when its row is on another page', async () => {
    resolveFacilities()
    render(<App />)

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Map marker Facility 22' }))

    expect(await screen.findByRole('row', { name: /Facility 22/ })).toHaveClass('selected-row')
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
  })

  it('filters by category, status, region, risk, and capacity, and resets all controls', async () => {
    resolveFacilities()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Dataset synced')

    await user.click(screen.getByRole('checkbox', { name: 'Parks & open space' }))
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('17')
    await user.click(screen.getByRole('checkbox', { name: 'Parks & open space' }))
    await user.click(screen.getByRole('checkbox', { name: 'Maintenance' }))
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('15')
    await user.click(screen.getByRole('button', { name: 'North' }))
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('7')

    fireEvent.change(screen.getByRole('slider', { name: 'Maximum risk score' }), { target: { value: '25' } })
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('2')
    fireEvent.change(screen.getByRole('slider', { name: 'Maximum capacity' }), { target: { value: '100' } })
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('2')

    await user.click(screen.getByRole('button', { name: 'Reset all filters' }))
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('23')
    expect(screen.getByRole('slider', { name: 'Maximum risk score' })).toHaveValue('100')
  })

  it('moves to the last valid table page after filtering down the result set', async () => {
    resolveFacilities()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Dataset synced')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search facilities' }), 'Central Park')

    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument()
  })

  it('sorts the directory by a selected column in either direction', async () => {
    resolveFacilities()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Dataset synced')

    await user.click(screen.getByRole('button', { name: 'Risk' }))
    expect(screen.getAllByRole('row')[1]).toHaveAccessibleName(/Central Park/)
    await user.click(screen.getByRole('button', { name: /Risk/ }))
    expect(screen.getAllByRole('row')[1]).toHaveAccessibleName(/Facility 20/)
  })

  it('retries a failed dataset request and recovers', async () => {
    vi.mocked(fetchFacilities)
      .mockRejectedValueOnce(new Error('Facility request failed (503)'))
      .mockResolvedValueOnce(sampleFacilities)
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Facility request failed (503)')
    await user.click(screen.getByRole('button', { name: /Retry/ }))

    expect(await screen.findByText('Dataset synced')).toBeInTheDocument()
    expect(screen.getByTestId('map-facility-count')).toHaveTextContent('23')
    expect(fetchFacilities).toHaveBeenCalledTimes(2)
  })

  it('exports the currently filtered facilities as a CSV', async () => {
    resolveFacilities()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Dataset synced')
    await user.type(screen.getByRole('searchbox', { name: 'Search facilities' }), 'Central Park')
    await user.click(screen.getByRole('button', { name: 'Export filtered facilities as CSV' }))

    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    expect(content).toContain('"facility-0","Central Park"')
    expect(content).not.toContain('"facility-1",')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:spatialview-export')
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
  })
})
