import type { Category, Facility, FacilityStatus } from '../types'

type OSMFeature = {
  type: 'Feature'
  id?: string | number
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    category: Category
    name?: string
    osm_type?: string
    osm_id?: number
    osm_url?: string
    tags?: Record<string, string>
  }
}

const categoryNames: Record<Category, string> = {
  hospital: 'Healthcare facility',
  university: 'Education facility',
  park: 'Park',
  'public-office': 'Public service facility',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(categoryNames, value)
  )
}

function isOSMFeature(value: unknown): value is OSMFeature {
  if (!isRecord(value) || value.type !== 'Feature') return false
  if (!isRecord(value.geometry) || value.geometry.type !== 'Point') return false
  if (!isRecord(value.properties) || !isCategory(value.properties.category)) {
    return false
  }

  const coordinates = value.geometry.coordinates
  return (
    Array.isArray(coordinates) &&
    typeof coordinates[0] === 'number' &&
    Number.isFinite(coordinates[0]) &&
    Math.abs(coordinates[0]) <= 180 &&
    typeof coordinates[1] === 'number' &&
    Number.isFinite(coordinates[1]) &&
    Math.abs(coordinates[1]) <= 90 &&
    (value.id === undefined ||
      typeof value.id === 'string' ||
      typeof value.id === 'number') &&
    (value.properties.name === undefined ||
      typeof value.properties.name === 'string') &&
    (value.properties.osm_type === undefined ||
      typeof value.properties.osm_type === 'string') &&
    (value.properties.osm_id === undefined ||
      (typeof value.properties.osm_id === 'number' &&
        Number.isInteger(value.properties.osm_id))) &&
    (value.properties.osm_url === undefined ||
      typeof value.properties.osm_url === 'string') &&
    (value.properties.tags === undefined ||
      (isRecord(value.properties.tags) &&
        Object.values(value.properties.tags).every(
          (tag) => typeof tag === 'string',
        )))
  )
}

function hash(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result
}

function toFacility(feature: OSMFeature): Facility {
  const id = String(
    feature.id ??
      `${feature.properties.osm_type ?? 'place'}/${feature.properties.osm_id ?? 'unknown'}`,
  )
  const seed = hash(id)
  const statuses: FacilityStatus[] = ['Active', 'Active', 'Active', 'Maintenance', 'Offline']
  const [longitude, latitude] = feature.geometry.coordinates
  const region =
    latitude > 33.76
      ? 'Northern outskirts'
      : latitude < 33.61
        ? 'Southern outskirts'
        : 'Islamabad area'

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    properties: {
      id,
      name: feature.properties.name?.trim() || categoryNames[feature.properties.category],
      category: feature.properties.category,
      status: statuses[seed % statuses.length]!,
      capacity: 15 + (seed % 286),
      riskScore: seed % 101,
      region,
      establishedYear: 1980 + (seed % 45),
      lastInspection: new Date(
        Date.UTC(2025, (seed >>> 4) % 12, 1 + ((seed >>> 8) % 28)),
      )
        .toISOString()
        .slice(0, 10),
      ...(feature.properties.osm_url
        ? { sourceUrl: feature.properties.osm_url }
        : {}),
    },
  }
}

export async function fetchFacilities(signal?: AbortSignal): Promise<Facility[]> {
  const endpoint =
    import.meta.env.VITE_FACILITIES_API_URL || '/data/islamabad-services.geojson'
  const response = await fetch(endpoint, {
    signal,
    headers: { Accept: 'application/geo+json, application/json' },
  })
  if (!response.ok) {
    throw new Error(`Facility request failed (${response.status})`)
  }

  const data: unknown = await response.json()
  if (
    !isRecord(data) ||
    data.type !== 'FeatureCollection' ||
    !Array.isArray(data.features) ||
    !data.features.every(isOSMFeature)
  ) {
    throw new Error('The facility GeoJSON is invalid or has an unsupported schema.')
  }

  return data.features.map(toFacility)
}
