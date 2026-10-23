import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
const maxFeatures = 10000

type BoundaryFeature = {
  type: 'Feature'
  id?: string | number
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: unknown
  }
  properties: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPosition(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((coordinate) =>
      typeof coordinate === 'number' && Number.isFinite(coordinate),
    ) &&
    Math.abs(value[0]!) <= 180 &&
    Math.abs(value[1]!) <= 90
  )
}

function isRing(value: unknown): value is number[][] {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) {
    return false
  }
  const first = value[0]!
  const last = value[value.length - 1]!
  return first[0] === last[0] && first[1] === last[1]
}

function isPolygonCoordinates(value: unknown): value is number[][][] {
  return Array.isArray(value) && value.length > 0 && value.every((ring) =>
    Array.isArray(ring) && ring.length > 0 && isRing(ring),
  )
}

function isGeometry(value: unknown): value is BoundaryFeature['geometry'] {
  if (!isRecord(value)) return false
  if (value.type === 'Polygon') {
    return isPolygonCoordinates(value.coordinates)
  }
  return (
    value.type === 'MultiPolygon' &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length > 0 &&
    value.coordinates.every(isPolygonCoordinates)
  )
}

function isBoundaryFeature(value: unknown): value is BoundaryFeature {
  return (
    isRecord(value) &&
    value.type === 'Feature' &&
    isGeometry(value.geometry) &&
    isRecord(value.properties) &&
    (value.id === undefined ||
      typeof value.id === 'string' ||
      (typeof value.id === 'number' && Number.isFinite(value.id)))
  )
}

function readProperty(
  properties: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = properties[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

async function main() {
  const defaultBoundaryPath = path.join(
    process.cwd(),
    'data',
    'islamabad-tehsil.geojson',
  )
  const sourcePath = path.resolve(
    process.env.BOUNDARIES_GEOJSON ?? defaultBoundaryPath,
  )

  const geoJsonText = (await readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '')
  const source = JSON.parse(geoJsonText) as unknown
  if (
    !isRecord(source) ||
    source.type !== 'FeatureCollection' ||
    !Array.isArray(source.features) ||
    source.features.length === 0 ||
    source.features.length > maxFeatures ||
    !source.features.every(isBoundaryFeature)
  ) {
    throw new Error(
      `Invalid boundary GeoJSON. Expected 1-${maxFeatures} Polygon/MultiPolygon features with closed EPSG:4326 rings: ${sourcePath}`,
    )
  }

  const nameProperty = process.env.BOUNDARY_NAME_PROPERTY ?? 'shapeName'
  const typeProperty = process.env.BOUNDARY_TYPE_PROPERTY ?? 'shapeType'
  const idProperty = process.env.BOUNDARY_ID_PROPERTY ?? 'shapeID'
  const sourceName =
    process.env.BOUNDARY_SOURCE_NAME ?? 'geoboundaries-pak-adm3'
  const boundaries = source.features.map((feature, index) => {
    const name =
      readProperty(feature.properties, nameProperty) ??
      (typeof feature.id === 'string' || typeof feature.id === 'number'
        ? String(feature.id)
        : undefined)
    if (!name) {
      throw new Error(
        `Boundary feature ${index + 1} needs a name in property "${nameProperty}" or a GeoJSON feature id.`,
      )
    }

    const sourceIdValue =
      readProperty(feature.properties, idProperty) ??
      (typeof feature.id === 'string' || typeof feature.id === 'number'
        ? String(feature.id)
        : undefined)
    const sourceId = sourceIdValue
      ? `${sourceName}/${sourceIdValue}`
      : `${sourceName}/geometry-${createHash('sha256')
          .update(JSON.stringify(feature.geometry))
          .digest('hex')}`

    return {
      sourceId,
      name,
      areaType: readProperty(feature.properties, typeProperty) ?? 'administrative',
      geometry: JSON.stringify(feature.geometry),
      properties: JSON.stringify(feature.properties),
    }
  })

  if (new Set(boundaries.map(({ sourceId }) => sourceId)).size !== boundaries.length) {
    throw new Error('Boundary GeoJSON contains duplicate source IDs.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  const replaceSource = process.argv.includes('--replace')

  try {
    await client.query('BEGIN')
    if (replaceSource) {
      await client.query('DELETE FROM administrative_areas WHERE source_name = $1', [
        sourceName,
      ])
    }

    for (const boundary of boundaries) {
      await client.query(
        `INSERT INTO administrative_areas
           (source_name, source_id, name, area_type, source_properties, geom)
         VALUES ($1, $2, $3, $4, $5::jsonb, ST_Multi(
           ST_CollectionExtract(
             ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)),
             3
           )
         ))
         ON CONFLICT (source_id) DO UPDATE SET
           source_name = EXCLUDED.source_name,
           name = EXCLUDED.name,
           area_type = EXCLUDED.area_type,
           source_properties = EXCLUDED.source_properties,
           geom = EXCLUDED.geom`,
        [
          sourceName,
          boundary.sourceId,
          boundary.name,
          boundary.areaType,
          boundary.properties,
          boundary.geometry,
        ],
      )
    }
    await client.query('COMMIT')
    console.log(
      `${replaceSource ? 'Replaced' : 'Imported'} ${boundaries.length} administrative areas from ${sourcePath} (${sourceName})`,
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('Boundary import failed:', error)
  process.exitCode = 1
})
