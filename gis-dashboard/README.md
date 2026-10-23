# SpatialView

SpatialView is a responsive React + Vite geospatial dashboard for exploring
service locations in Islamabad. It uses Tailwind CSS with dashboard styling,
React-Leaflet for mapping, Recharts for analytics, and Lucide for interface
icons.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build, run
`npm run build`.

## Facility data endpoint

By default, the app requests the bundled GeoJSON fixture at
`/data/islamabad-services.geojson`. To connect a REST endpoint, copy
`.env.example` to `.env.local` and set `VITE_FACILITIES_API_URL` to an endpoint
that returns a valid GeoJSON `FeatureCollection` of point features using the
same `category`, `name`, and optional OpenStreetMap source properties as the
fixture. Vite environment variables are read at startup, so restart the dev
server after changing this setting.

## Service coverage analysis

Use the **Coverage** control above the map to request administrative-area
coverage from the Phase 3 API. Choose a service radius and facility type; areas
are shaded by the percentage of their geographic surface within range of the
matching facilities. Hover an area to see its name and percentage. Coverage
requires PostGIS and administrative-area boundary polygons loaded into the
Phase 3 database. Results describe geographic area only, not population,
capacity, accessibility, or service quality.

By default the dashboard requests
`http://localhost:3000/api/facilities/coverage`. To use a different API, set
`VITE_COVERAGE_API_URL` in `.env.local` and restart Vite. Coverage request
errors appear in the map controls with a retry action.

## Validate changes

```sh
npm test
npx tsc --noEmit
npm run build
```

## Dashboard features

- Filter facilities by name, type, status, risk, capacity, and region.
- Explore the filtered subset in the map, analytics charts, and sortable,
  paginated facility table.
- Select a map marker or table row to open the facility profile and synchronize
  the map and table selection.
- Switch between street and dark basemaps and export the filtered facility
  list to CSV. The page stays in a simple light theme; the dark map uses a
  dark-gray basemap with a separate labels layer.
- Retry the GeoJSON request if data loading fails.

## What Phase 3 adds

The earlier dashboard read a bundled GeoJSON file in the browser. Phase 3 adds
a PostgreSQL/PostGIS-backed Express API for live facility features, category
and bounding-box filters, proximity searches, and map coverage analysis. The
dashboard can now request those spatial results rather than calculating
coverage from only the displayed markers.

This can help city teams compare where mapped services are concentrated or
where additional investigation may be useful. Residents can explore the
locations and coverage context in one map. Current coverage means the share of
the loaded boundary's land area within a chosen straight-line radius of mapped
facilities—it does not measure population, travel time, operating status,
capacity, or service quality. The available Islamabad boundary is one
tehsil-level polygon, so it is too coarse to support claims about individual
sectors or neighborhoods. Operational metrics in the dashboard are still
demonstration values.

## Data and limitations

The bundled GeoJSON snapshot is
[`public/data/islamabad-services.geojson`](public/data/islamabad-services.geojson).
Its mapped locations and source tags come from OpenStreetMap. The dashboard
generates deterministic **demo-only** status, capacity, risk, region, year, and
inspection values from each feature ID; these attributes are not verified
operational records and should not be used for real-world decisions.

OpenStreetMap data is community-maintained and may be incomplete or outdated.
The source snapshot includes hospitals, universities, parks, and public
offices, including locations near the Islamabad/Rawalpindi boundary. Attribute
OpenStreetMap contributors when reusing the map data:
[© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
