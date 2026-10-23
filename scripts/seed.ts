import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
const allowedCategories = new Set([
  'hospital',
  'university',
  'park',
  'public-office',
])

type SeedFeature = {
  type: 'Feature'
  id?: string | number
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    category: string
    name?: string
    osm_type?: string
    osm_id?: number
    tags?: Record<string, string>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSeedFeature(value: unknown): value is SeedFeature {
  if (!isRecord(value) || value.type !== 'Feature') return false
  if (!isRecord(value.geometry) || value.geometry.type !== 'Point') return false
  if (!isRecord(value.properties)) return false
  const { category, name, osm_type: osmType, osm_id: osmId, tags } = value.properties
  const coordinates = value.geometry.coordinates

  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    typeof coordinates[0] === 'number' &&
    Number.isFinite(coordinates[0]) &&
    Math.abs(coordinates[0]) <= 180 &&
    typeof coordinates[1] === 'number' &&
    Number.isFinite(coordinates[1]) &&
    Math.abs(coordinates[1]) <= 90 &&
    typeof category === 'string' &&
    allowedCategories.has(category) &&
    (name === undefined || typeof name === 'string') &&
    (osmType === undefined || typeof osmType === 'string') &&
    (osmId === undefined ||
      (typeof osmId === 'number' && Number.isSafeInteger(osmId) && osmId > 0)) &&
    (tags === undefined ||
      (isRecord(tags) && Object.values(tags).every((tag) => typeof tag === 'string')))
  )
}

async function main() {
  const sourcePath = path.resolve(
    process.env.FACILITIES_GEOJSON ??
      path.join(process.cwd(), 'gis-dashboard', 'public', 'data', 'islamabad-services.geojson'),
  )
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as unknown

  if (
    !isRecord(source) ||
    source.type !== 'FeatureCollection' ||
    !Array.isArray(source.features) ||
    !source.features.every(isSeedFeature)
  ) {
    throw new Error(`Invalid or unsupported facilities GeoJSON: ${sourcePath}`)
  }

  if (source.features.length === 0) {
    throw new Error(`Refusing to seed from an empty FeatureCollection: ${sourcePath}`)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  let imported = 0

  try {
    await client.query('BEGIN')
    for (const feature of source.features) {
      const [longitude, latitude] = feature.geometry.coordinates
      const { category, name, osm_type: osmType, osm_id: osmId, tags = {} } =
        feature.properties
      const featureName =
        name?.trim() ||
        (typeof tags.name === 'string' ? tags.name.trim() : '') ||
        `${category} ${osmId ?? feature.id ?? imported + 1}`

      await client.query(
        `INSERT INTO facilities (osm_type, osm_id, name, category, tags, geom)
         VALUES ($1, $2, $3, $4, $5::jsonb, ST_SetSRID(ST_MakePoint($6, $7), 4326))
         ON CONFLICT (osm_type, osm_id) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           tags = EXCLUDED.tags,
           geom = EXCLUDED.geom,
           updated_at = NOW()`,
        [
          osmType ?? null,
          osmId ?? null,
          featureName,
          category,
          JSON.stringify(tags),
          longitude,
          latitude,
        ],
      )
      imported += 1
    }
    await client.query('COMMIT')
    console.log(`Imported ${imported} facilities from ${sourcePath}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('Facility seeding failed:', error)
  process.exitCode = 1
})
