import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { Pool } from 'pg'
import type { Server } from 'node:http'
import { createApp } from './app.js'

describe('SpatialView API', () => {
  let server: Server
  let baseUrl: string
  const queries: { text: string; values: unknown[] }[] = []
  let queryRows: { feature: object }[] = []
  const pool = {
    query: async (text: string, values: unknown[] = []) => {
      queries.push({ text, values })
      return { rows: queryRows }
    },
  } as unknown as Pool

  before(async () => {
    server = createApp(pool).listen(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const { port } = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  })

  it('returns an empty GeoJSON FeatureCollection', async () => {
    const response = await fetch(`${baseUrl}/api/facilities`)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      type: 'FeatureCollection',
      features: [],
    })
    assert.match(queries.at(-1)!.text, /FROM facilities f/)
  })

  it('binds category, area ID, and bbox values to the query', async () => {
    const response = await fetch(
      `${baseUrl}/api/facilities?category=park&areaId=12&bbox=73,33.5,73.3,33.9`,
    )

    assert.equal(response.status, 200)
    assert.deepEqual(queries.at(-1)!.values, [
      'park',
      12,
      73,
      33.5,
      73.3,
      33.9,
    ])
    assert.match(queries.at(-1)!.text, /ST_Intersects\(a\.geom, f\.geom\)/)
    assert.match(queries.at(-1)!.text, /ST_MakeEnvelope/)
  })

  it('binds proximity parameters and uses geography distance', async () => {
    const response = await fetch(
      `${baseUrl}/api/facilities/nearby?lng=73.05&lat=33.68&radiusMeters=2000&category=hospital`,
    )

    assert.equal(response.status, 200)
    assert.deepEqual(queries.at(-1)!.values, [73.05, 33.68, 2000, 'hospital'])
    assert.match(queries.at(-1)!.text, /ST_DWithin/)
    assert.match(queries.at(-1)!.text, /f\.geom::geography/)
  })

  it('returns administrative-area coverage as GeoJSON', async () => {
    const coverageFeature = {
      type: 'Feature',
      id: '3',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [],
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
    }
    queryRows = [{ feature: coverageFeature }]

    const response = await fetch(
      `${baseUrl}/api/facilities/coverage?radiusMeters=1500&category=hospital`,
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      type: 'FeatureCollection',
      features: [coverageFeature],
    })
    assert.deepEqual(queries.at(-1)!.values, [1500, 'hospital'])
    assert.match(queries.at(-1)!.text, /ST_Union\(ST_Buffer/)
    assert.match(queries.at(-1)!.text, /ST_Intersection\(a\.geom, sc\.geom\)/)
    assert.match(queries.at(-1)!.text, /coveragePercent/)
    queryRows = []
  })

  it('rejects invalid filters without querying the database', async () => {
    const queryCount = queries.length
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/facilities?category=unknown`),
      fetch(`${baseUrl}/api/facilities?bbox=1,2,not-a-number,4`),
      fetch(`${baseUrl}/api/facilities?areaId=-1`),
      fetch(`${baseUrl}/api/facilities/nearby?lng=0&lat=91&radiusMeters=10`),
      fetch(`${baseUrl}/api/facilities/coverage?radiusMeters=0`),
    ])

    assert.deepEqual(responses.map((response) => response.status), [
      400, 400, 400, 400, 400,
    ])
    assert.equal(queries.length, queryCount)
  })
})
