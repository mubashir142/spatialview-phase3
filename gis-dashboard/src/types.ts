export const categories = {
  hospital: { label: 'Healthcare', color: '#ef7b67' },
  university: { label: 'Education', color: '#8b83f6' },
  park: { label: 'Parks & open space', color: '#4dbb91' },
  'public-office': { label: 'Public services', color: '#e8b45d' },
} as const

export type Category = keyof typeof categories
export type FacilityStatus = 'Active' | 'Maintenance' | 'Offline'

export type Facility = {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    id: string
    name: string
    category: Category
    status: FacilityStatus
    capacity: number
    riskScore: number
    region: string
    establishedYear: number
    lastInspection: string
    sourceUrl?: string
  }
}

export type FacilityFilters = {
  search: string
  categories: Category[]
  statuses: FacilityStatus[]
  maxRisk: number
  maxCapacity: number
  region: string
}
