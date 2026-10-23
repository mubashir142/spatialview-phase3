import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFacilities } from './facilities'

function featureCollection() {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'node/one',
        geometry: { type: 'Point', coordinates: [73.05, 33.68] },
        properties: {
          category: 'park',
          name: 'Test Park',
          osm_url: 'https://www.openstreetmap.org/node/one',
        },
      },
    ],
  }
}

describe('fetchFacilities', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FACILITIES_API_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('loads and maps a GeoJSON FeatureCollection from the default fixture', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(featureCollection()), {
        status: 200,
        headers: { 'Content-Type': 'application/geo+json' },
      }),
    )

    const facilities = await fetchFacilities()

    expect(fetchMock).toHaveBeenCalledWith('/data/islamabad-services.geojson', {
      signal: undefined,
      headers: { Accept: 'application/geo+json, application/json' },
    })
    expect(facilities).toHaveLength(1)
    expect(facilities[0]).toMatchObject({
      geometry: { coordinates: [73.05, 33.68] },
      properties: {
        id: 'node/one',
        name: 'Test Park',
        category: 'park',
        sourceUrl: 'https://www.openstreetmap.org/node/one',
      },
    })
  })

  it('uses a configured REST endpoint and forwards cancellation', async () => {
    vi.stubEnv('VITE_FACILITIES_API_URL', 'https://api.example.test/facilities')
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(featureCollection()), { status: 200 }),
    )

    await fetchFacilities(controller.signal)

    expect(fetch).toHaveBeenCalledWith('https://api.example.test/facilities', {
      signal: controller.signal,
      headers: { Accept: 'application/geo+json, application/json' },
    })
  })

  it('rejects when the request is aborted', async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('The request was aborted.', 'AbortError')),
            { once: true },
          )
        }),
    )

    const request = fetchFacilities(controller.signal)
    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('surfaces HTTP errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unavailable', { status: 503, statusText: 'Service Unavailable' }),
    )

    await expect(fetchFacilities()).rejects.toThrow('Facility request failed (503)')
  })

  it('rejects an unsupported or invalid GeoJSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [999, 0] }, properties: { category: 'park' } }],
      }), { status: 200 }),
    )

    await expect(fetchFacilities()).rejects.toThrow(
      'The facility GeoJSON is invalid or has an unsupported schema.',
    )
  })
})
