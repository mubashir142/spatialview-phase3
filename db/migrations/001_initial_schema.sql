CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS facilities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  osm_type TEXT,
  osm_id BIGINT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('hospital', 'university', 'park', 'public-office')
  ),
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  risk_score NUMERIC(5, 2) CHECK (
    risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)
  ),
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (osm_type, osm_id)
);

CREATE TABLE IF NOT EXISTS administrative_areas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  area_type TEXT NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilities_geom
  ON facilities USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_facilities_geography
  ON facilities USING GIST ((geom::geography));
CREATE INDEX IF NOT EXISTS idx_facilities_category
  ON facilities (category);
CREATE INDEX IF NOT EXISTS idx_administrative_areas_geom
  ON administrative_areas USING GIST (geom);
