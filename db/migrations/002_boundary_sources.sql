ALTER TABLE administrative_areas
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS source_properties JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE administrative_areas
SET source_name = COALESCE(source_name, 'legacy'),
    source_id = COALESCE(source_id, 'legacy/' || id::text);

ALTER TABLE administrative_areas
  ALTER COLUMN source_name SET NOT NULL,
  ALTER COLUMN source_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_administrative_areas_source_id
  ON administrative_areas (source_id);
CREATE INDEX IF NOT EXISTS idx_administrative_areas_source_name
  ON administrative_areas (source_name);
