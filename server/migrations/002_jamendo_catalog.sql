ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_provider_check;
ALTER TABLE tracks
  ADD CONSTRAINT tracks_provider_check CHECK (provider IN ('youtube', 'audio', 'jamendo'));

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS attribution_url text,
  ADD COLUMN IF NOT EXISTS license_url text;
