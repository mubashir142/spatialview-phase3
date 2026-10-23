import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCoverage } from './coverage'

function featureCollection() {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: '1',
        geometry: {
          type: 'Polygon',
          coordinates: [[[73, 33], [73.1, 33], [73.1, 33.1], [73, 33.1], [73, 33]]],
        },
        properties: {
          name: 'Sector G-6',
          areaType: 'sector',
          radiusMeters: 1500,
          category: 'hospital',
          totalAreaKm2: 4.25,
          coveredAreaKm2: 3.5,
          coveragePercent: 82.35,
        },
      },
    ],
  }
}

describe('fetchCoverage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('requests coverage with radius and category and returns polygons', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(featureCollection()), {
        status: 200,
        headers: { 'Content-Type': 'application/geo+json' },
      }),
    )

    const features = await fetchCoverage(1500, 'hospital')

    const [requestUrl, options] = fetchMock.mock.calls[0]!
    expect(String(requestUrl)).toBe(
      'http://localhost:3000/api/facilities/coverage?radiusMeters=1500&category=hospital',
    )
    expect(options?.headers).toEqual({
      Accept: 'application/geo+json, application/json',
    })
    expect(features).toHaveLength(1)
    expect(features[0]?.properties.coveragePercent).toBe(82.35)
  })

  it('omits category when requesting all services', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [],
      }), { status: 200 }),
    )

    await fetchCoverage(3000, 'all')

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'http://localhost:3000/api/facilities/coverage?radiusMeters=3000',
    )
  })

  it('surfaces HTTP and invalid GeoJSON errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unavailable', { status: 503 }),
    )
    await expect(fetchCoverage(1000, 'all')).rejects.toThrow(
      'Coverage request failed (503)',
    )

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          ...featureCollection().features[0],
          properties: { ...featureCollection().features[0]!.properties, coveragePercent: 120 },
        }],
      }), { status: 200 }),
    )
    await expect(fetchCoverage(1000, 'all')).rejects.toThrow(
      'The coverage GeoJSON is invalid or has an unsupported schema.',
    )
  })
})
