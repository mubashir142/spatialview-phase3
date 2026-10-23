# SpatialView Phase 3

Starter backend for the SpatialView geospatial dashboard: an Express API and
PostgreSQL/PostGIS schema. Docker is not required. PostgreSQL and the PostGIS
extension run as native Windows software; GeoServer is deferred until WMS/WFS
publishing is needed.

## Native Windows setup

1. Run the verified PostgreSQL 16 installer. Keep **Stack Builder** selected
   during setup. Set a password for the PostgreSQL `postgres` administrator
   account and remember it locally; don't share it in chat.
2. When PostgreSQL setup finishes, open **Stack Builder** from the Start menu.
   Select the PostgreSQL 16 installation, then install the compatible PostGIS
   package from the Spatial Extensions category.
3. Open **SQL Shell (psql)** from the Start menu and connect as the PostgreSQL
   administrator (usually `postgres`). Run these statements one at a time,
   replacing the sample password:

   ```sql
   CREATE ROLE spatialview LOGIN PASSWORD 'choose-a-local-password';
   CREATE DATABASE spatialview OWNER spatialview;
   ```

4. Connect to the new database as the administrator and enable PostGIS:

   ```sql
   \connect spatialview
   CREATE EXTENSION postgis;
   ```

5. In PowerShell, from this folder, create your local environment file and
   install the API dependencies:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   npm install
   ```

   Set `DATABASE_URL` in `.env` to the connection string for the database role and database you created. If its password contains URL-reserved characters, percent-encode them in the connection string. Keep the value private.
6. Run the schema migration and import the facilities and boundary:

   ```powershell
   npm run db:migrate
   npm run seed
   npm run db:import-boundaries
   ```

7. Start the API:

   ```powershell
   npm run dev
   ```

The seed command reads
`gis-dashboard\public\data\islamabad-services.geojson` by default, upserts
the source features in a transaction, and can be safely rerun. Set
`FACILITIES_GEOJSON` to use a different fixture path.

## Load administrative boundaries

Coverage results need real administrative polygons; the bundled facility
fixture does not contain them. The project includes one Islamabad tehsil
boundary from geoBoundaries Pakistan ADM3 (2017). This is a tehsil-level
administrative boundary, not Islamabad's
individual sectors or neighborhoods. Its source and license are documented in
[`data/README.md`](data/README.md). The data is a real published polygon, not a
boundary inferred from the facility points or fixture bounding box. If your
analysis needs sector/neighborhood coverage, substitute an appropriate
licensed sector-level GeoJSON dataset and update the import property settings.

After running migrations, import the polygons with `npm run db:import-boundaries`
(included in the setup steps above).

The importer defaults to the included GeoJSON and its geoBoundaries properties.
Override `BOUNDARIES_GEOJSON`, `BOUNDARY_SOURCE_NAME`,
`BOUNDARY_NAME_PROPERTY`, `BOUNDARY_TYPE_PROPERTY`, or `BOUNDARY_ID_PROPERTY`
in `.env` to import another source. It validates the entire FeatureCollection
before writing, runs all upserts in one transaction, repairs invalid polygon
geometry, converts Polygon features to MultiPolygon, and retains source
properties. Features need a name (or GeoJSON feature ID).
Features with an ID are upserted by that ID; otherwise a stable geometry hash
is used. Reimporting updates matching features but does not remove boundaries
that disappeared from the source file. To replace only this import source and
remove stale features, explicitly run:

```powershell
npm run db:import-boundaries -- --replace
```

`--replace` deletes rows for the configured `BOUNDARY_SOURCE_NAME` inside the
same transaction before importing the current file. Keep the same source name
when updating that dataset.

## API

- `GET /health` checks API and database availability.
- `GET /api/facilities` returns a GeoJSON `FeatureCollection` compatible with
  the current dashboard’s `VITE_FACILITIES_API_URL`.
- `GET /api/facilities?category=park` filters by category.
- `GET /api/facilities?bbox=73.0,33.5,73.3,33.9` filters within a
  `minLng,minLat,maxLng,maxLat` bounding box.
- `GET /api/facilities?areaId=1` selects facilities intersecting the
  administrative area with that database ID.
- `GET /api/facilities/nearby?lng=73.05&lat=33.68&radiusMeters=2000`
  searches by geodesic distance; an optional `category` filter is supported.
- `GET /api/facilities/coverage?radiusMeters=1500&category=hospital`
  returns administrative-area GeoJSON with the percentage of each area's
  geographic surface within that distance of matching facilities. The category
  is optional.

All query values are validated and passed as PostgreSQL parameters. The nearby
and coverage endpoints limit radii to 50 km; the facility and nearby endpoints
limit responses to 1,000 results. Coverage percentages measure land area only,
not population, capacity, accessibility, or service quality. Coverage results
require administrative-area polygons to be loaded into `administrative_areas`.

Run `npm test` and `npm run build` to validate the API. API tests use a mock
database and do not require PostgreSQL.

## Dashboard integration

In the `gis-dashboard` Vite app, set
`VITE_FACILITIES_API_URL=http://localhost:3000/api/facilities` in its
`.env.local`, then restart Vite. The coverage control uses
`http://localhost:3000/api/facilities/coverage` by default; override it with
`VITE_COVERAGE_API_URL` if needed. The API returns the source fields consumed
by the dashboard (`category`, `name`, and optional OpenStreetMap identifiers
and tags). Existing dashboard-only status, capacity, and risk values remain
demo-generated until the frontend data model is intentionally migrated.

## Deploy the full project

This repository contains both applications. Deploy the dashboard and API as
separate services; the PostgreSQL/PostGIS database must also be hosted and
reachable by the API.

### Dashboard on Vercel

1. Import this GitHub repository into Vercel.
2. Set **Root Directory** to `gis-dashboard` and use the Vite preset. The build
   command is `npm run build` and the output directory is `dist`.
3. Set these environment variables for Production, replacing the host with the
   API's public HTTPS URL:

   ```text
   VITE_FACILITIES_API_URL=https://<api-host>/api/facilities
   VITE_COVERAGE_API_URL=https://<api-host>/api/facilities/coverage
   ```

4. Set the API's `CLIENT_ORIGIN` to the exact Vercel site origin, then redeploy
   the frontend after environment-variable changes.

These `VITE_` values are public browser configuration. Never put
`DATABASE_URL` or database credentials in Vercel frontend variables. If the API
URLs are omitted, the dashboard uses its bundled facility data, but live
coverage still requires the API.

### API and PostGIS database

Deploy the API from the repository root as a Node.js web service. Use
`npm ci && npm run build` as the build command and `npm start` as the start
command. Configure `DATABASE_URL` as a secret using a hosted PostgreSQL
connection string with PostGIS enabled, and set `CLIENT_ORIGIN` to the Vercel
origin. The server listens on the port assigned by the hosting platform.

Apply migrations and load data against the hosted database using the commands
above (`npm run db:migrate`, `npm run seed`, and
`npm run db:import-boundaries`). Run them from this repository's API folder
with `DATABASE_URL` set securely in your local environment. Do not commit or
share the connection string. Confirm `https://<api-host>/health` reports a
healthy database connection before configuring the frontend.

## Later: GeoServer

GeoServer is not required to run the API or dashboard integration. When WMS/WFS
publishing is needed, install GeoServer separately and configure a PostGIS
store pointing to `localhost:5432`, database `spatialview`, schema `public`,
and the database credentials in `.env`. Publish `facilities` and
`administrative_areas` with native CRS `EPSG:4326`.

## Schema

`db/migrations/001_initial_schema.sql` creates `facilities` and
`administrative_areas` with EPSG:4326 geometry. `npm run db:migrate` applies
each numbered SQL migration once and records it in `schema_migrations`.
Migration 002 adds source tracking to administrative boundaries. GiST indexes
support geometry and bounding-box queries; a geography GiST expression index
supports `ST_DWithin` proximity queries. Facility categories match the
dashboard's existing category identifiers.
