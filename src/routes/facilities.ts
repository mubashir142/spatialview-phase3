import { Router } from 'express'
import type { Pool } from 'pg'

const categories = new Set([
  'hospital',
  'university',
  'park',
  'public-office',
])

type GeoJsonFeature = {
  type: 'Feature'
  id: string
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    category: string
    name: string
    osm_type: string | null
    osm_id: number | null
    osm_url?: string
    tags: Record<string, string>
  }
}

type FeatureRow = { feature: GeoJsonFeature }

const featureJson = `jsonb_build_object(
  'type', 'Feature',
  'id', COALESCE(f.osm_type || '/' || f.osm_id::text, f.id::text),
  'geometry', ST_AsGeoJSON(f.geom)::jsonb,
  'properties', jsonb_strip_nulls(jsonb_build_object(
    'category', f.category,
    'name', f.name,
    'osm_type', f.osm_type,
    'osm_id', f.osm_id,
    'osm_url', CASE
      WHEN f.osm_type IS NOT NULL AND f.osm_id IS NOT NULL
      THEN 'https://www.openstreetmap.org/' || f.osm_type || '/' || f.osm_id::text
    END,
    'tags', f.tags
  ))
)`

function parseNumber(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseBoundingBox(
  value: unknown,
): [number, number, number, number] | null {
  if (typeof value !== 'string') return null
  const values = value.split(',').map(parseNumber)
  if (
    values.length !== 4 ||
    values.some((coordinate) => coordinate === null)
  ) {
    return null
  }

  const [minLng, minLat, maxLng, maxLat] = values
  if (
    minLng === null ||
    minLat === null ||
    maxLng === null ||
    maxLat === null ||
    minLng < -180 ||
    minLng > 180 ||
    maxLng < -180 ||
    maxLng > 180 ||
    minLat < -90 ||
    minLat > 90 ||
    maxLat < -90 ||
    maxLat > 90 ||
    minLng >= maxLng ||
    minLat >= maxLat
  ) {
    return null
  }
  return [minLng, minLat, maxLng, maxLat]
}

function parseCategory(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !categories.has(value)) return null
  return value
}

function featureCollection(features: GeoJsonFeature[]) {
  return { type: 'FeatureCollection', features }
}

export function createFacilitiesRouter(pool: Pool): Router {
  const router = Router()

  router.get('/coverage', async (request, response, next) => {
    const radiusMeters = parseNumber(request.query.radiusMeters)
    const category = parseCategory(request.query.category)

    if (
      radiusMeters === null ||
      radiusMeters <= 0 ||
      radiusMeters > 50000 ||
      category === null
    ) {
      response.status(400).json({
        error: 'Provide radiusMeters between 1 and 50000 and an optional valid category.',
      })
      return
    }

    try {
      const result = await pool.query<FeatureRow>(
        `WITH service_coverage AS (
           SELECT ST_Union(ST_Buffer(f.geom::geography, $1)::geometry) AS geom
           FROM facilities f
           WHERE ($2::text IS NULL OR f.category = $2)
         ),
         area_metrics AS (
           SELECT
             a.id,
             a.name,
             a.area_type,
             a.geom AS area_geom,
             ST_Area(a.geom::geography) AS total_area_m2,
             COALESCE(
               ST_Area(ST_Intersection(a.geom, sc.geom)::geography),
               0
             ) AS covered_area_m2
           FROM administrative_areas a
           CROSS JOIN service_coverage sc
         )
         SELECT jsonb_build_object(
           'type', 'Feature',
           'id', id::text,
           'geometry', ST_AsGeoJSON(area_geom)::jsonb,
           'properties', jsonb_build_object(
             'name', name,
             'areaType', area_type,
             'radiusMeters', $1,
             'category', $2,
             'totalAreaKm2', ROUND((total_area_m2 / 1000000)::numeric, 3),
             'coveredAreaKm2', ROUND((covered_area_m2 / 1000000)::numeric, 3),
             'coveragePercent', ROUND(
               (covered_area_m2 / NULLIF(total_area_m2, 0) * 100)::numeric,
               2
             )
           )
         ) AS feature
         FROM area_metrics
         WHERE total_area_m2 > 0
         ORDER BY name, id`,
        [radiusMeters, category ?? null],
      )

      response.json(featureCollection(result.rows.map((row) => row.feature)))
    } catch (error) {
      next(error)
    }
  })

  router.get('/', async (request, response, next) => {
    try {
      const category = parseCategory(request.query.category)
      if (category === null) {
        response.status(400).json({ error: 'Invalid category.' })
        return
      }

      const values: (string | number)[] = []
      const conditions: string[] = []
      if (category !== undefined) {
        values.push(category)
        conditions.push(`f.category = $${values.length}`)
      }

      if (request.query.areaId !== undefined) {
        const areaId = typeof request.query.areaId === 'string'
          ? Number(request.query.areaId)
          : Number.NaN
        if (!Number.isSafeInteger(areaId) || areaId <= 0) {
          response.status(400).json({ error: 'areaId must be a positive integer.' })
          return
        }
        values.push(areaId)
        conditions.push(
          `EXISTS (
             SELECT 1
             FROM administrative_areas a
             WHERE a.id = $${values.length}
               AND ST_Intersects(a.geom, f.geom)
           )`,
        )
      }

      if (request.query.bbox !== undefined) {
        const bbox = parseBoundingBox(request.query.bbox)
        if (bbox === null) {
          response.status(400).json({
            error: 'bbox must be minLng,minLat,maxLng,maxLat within EPSG:4326.',
          })
          return
        }

        values.push(...bbox)
        const offset = values.length - 3
        conditions.push(
          `f.geom && ST_MakeEnvelope($${offset}, $${offset + 1}, $${offset + 2}, $${offset + 3}, 4326)`,
          `ST_Intersects(f.geom, ST_MakeEnvelope($${offset}, $${offset + 1}, $${offset + 2}, $${offset + 3}, 4326))`,
        )
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const result = await pool.query<FeatureRow>(
        `SELECT ${featureJson} AS feature
         FROM facilities f
         ${where}
         ORDER BY f.id
         LIMIT 1000`,
        values,
      )
      response.json(featureCollection(result.rows.map((row) => row.feature)))
    } catch (error) {
      next(error)
    }
  })

  router.get('/nearby', async (request, response, next) => {
    const lng = parseNumber(request.query.lng)
    const lat = parseNumber(request.query.lat)
    const radiusMeters = parseNumber(request.query.radiusMeters)
    const category = parseCategory(request.query.category)

    if (
      lng === null ||
      lat === null ||
      radiusMeters === null ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90 ||
      radiusMeters <= 0 ||
      radiusMeters > 50000 ||
      category === null
    ) {
      response.status(400).json({
        error: 'Provide valid lng, lat, radiusMeters (1-50000), and optional category.',
      })
      return
    }

    try {
      const values: (string | number)[] = [lng, lat, radiusMeters]
      const categoryCondition = category === undefined
        ? ''
        : 'AND f.category = $4'
      if (category !== undefined) values.push(category)

      const result = await pool.query<FeatureRow>(
        `SELECT ${featureJson} AS feature
         FROM facilities f
         WHERE ST_DWithin(
           f.geom::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3
         )
         ${categoryCondition}
         ORDER BY ST_Distance(
           f.geom::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
         )
         LIMIT 1000`,
        values,
      )
      response.json(featureCollection(result.rows.map((row) => row.feature)))
    } catch (error) {
      next(error)
    }
  })

  return router
}
