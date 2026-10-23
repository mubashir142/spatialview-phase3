import { categories as facilityCategories } from '../types'
import type { Category } from '../types'
import type {
  Feature as GeoJsonFeature,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson'

export type CoverageProperties = {
  name: string
  areaType: string
  radiusMeters: number
  category: Category | null
  totalAreaKm2: number
  coveredAreaKm2: number
  coveragePercent: number
}

export type CoverageFeature = GeoJsonFeature<
  Polygon | MultiPolygon,
  CoverageProperties
>

function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(facilityCategories, value)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPosition(value: unknown): value is Position {
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

function isLinearRing(value: unknown): value is number[][] {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) {
    return false
  }
  const first = value[0]!
  const last = value[value.length - 1]!
  return first[0] === last[0] && first[1] === last[1]
}

function isPolygonCoordinates(value: unknown): value is number[][][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isLinearRing)
  )
}

function isGeometry(
  value: unknown,
): value is Polygon | MultiPolygon {
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

function isCoverageFeature(value: unknown): value is CoverageFeature {
  if (
    !isRecord(value) ||
    value.type !== 'Feature' ||
    (typeof value.id !== 'string' && typeof value.id !== 'number') ||
    !isGeometry(value.geometry) ||
    !isRecord(value.properties)
  ) {
    return false
  }

  const properties = value.properties
  return (
    typeof properties.name === 'string' &&
    typeof properties.areaType === 'string' &&
    typeof properties.radiusMeters === 'number' &&
    Number.isFinite(properties.radiusMeters) &&
    (properties.category === null ||
      isCategory(properties.category)) &&
    typeof properties.totalAreaKm2 === 'number' &&
    Number.isFinite(properties.totalAreaKm2) &&
    typeof properties.coveredAreaKm2 === 'number' &&
    Number.isFinite(properties.coveredAreaKm2) &&
    typeof properties.coveragePercent === 'number' &&
    Number.isFinite(properties.coveragePercent) &&
    properties.coveragePercent >= 0 &&
    properties.coveragePercent <= 100
  )
}

function isFeatureCollection(value: unknown): value is {
  type: 'FeatureCollection'
  features: CoverageFeature[]
} {
  return (
    isRecord(value) &&
    value.type === 'FeatureCollection' &&
    Array.isArray(value.features) &&
    value.features.every(isCoverageFeature)
  )
}

export async function fetchCoverage(
  radiusMeters: number,
  category: Category | 'all',
  signal?: AbortSignal,
): Promise<CoverageFeature[]> {
  const endpoint =
    import.meta.env.VITE_COVERAGE_API_URL ??
    'http://localhost:3000/api/facilities/coverage'
  const url = new URL(endpoint, window.location.origin)
  url.searchParams.set('radiusMeters', String(radiusMeters))
  if (category !== 'all') url.searchParams.set('category', category)

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/geo+json, application/json' },
  })
  if (!response.ok) {
    throw new Error(`Coverage request failed (${response.status})`)
  }

  const data: unknown = await response.json()
  if (!isFeatureCollection(data)) {
    throw new Error('The coverage GeoJSON is invalid or has an unsupported schema.')
  }
  return data.features
}
