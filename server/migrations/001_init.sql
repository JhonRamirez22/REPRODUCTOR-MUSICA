CREATE TABLE IF NOT EXISTS playlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  revision    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playlists_owner_idx ON playlists (owner_id);

CREATE TABLE IF NOT EXISTS tracks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id   uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position >= 0),
  provider      text NOT NULL CHECK (provider IN ('youtube', 'audio')),
  source_id     text NOT NULL,
  source_url    text NOT NULL,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  artist        text,
  duration_sec  integer CHECK (duration_sec >= 0),
  thumbnail_url text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS tracks_playlist_order_idx ON tracks (playlist_id, position);
