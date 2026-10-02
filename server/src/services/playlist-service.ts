import { randomUUID } from 'node:crypto';
import {
  DoublyLinkedList,
  type Provider,
  type Playlist,
  type PlaylistSummary,
  type ResolvedCatalogTrack,
  type Track,
} from '@reproductor/shared';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { AppConfig } from '../config.js';
import { HttpError } from '../errors.js';

interface PlaylistRow extends QueryResultRow {
  id: string;
  name: string;
  revision: number;
  created_at: Date;
  updated_at: Date;
  track_count?: string | number;
}

interface TrackRow extends QueryResultRow {
  id: string;
  playlist_id: string;
  position: number;
  provider: Provider;
  source_id: string;
  source_url: string;
  title: string;
  artist: string | null;
  duration_sec: number | null;
  thumbnail_url: string | null;
  attribution_url: string | null;
  license_url: string | null;
}

export class PlaylistService {
  constructor(
    private readonly pool: Pool,
    private readonly config: Pick<AppConfig, 'MAX_PLAYLISTS_PER_OWNER' | 'MAX_TRACKS_PER_PLAYLIST'>,
  ) {}

  async list(ownerId: string): Promise<PlaylistSummary[]> {
    const result = await this.pool.query<PlaylistRow>(
      `SELECT p.id, p.name, p.revision, p.created_at, p.updated_at,
              COUNT(t.id)::int AS track_count
         FROM playlists p
         LEFT JOIN tracks t ON t.playlist_id = p.id
        WHERE p.owner_id = $1
        GROUP BY p.id
        ORDER BY p.updated_at DESC, p.created_at DESC`,
      [ownerId],
    );
    return result.rows.map((row) => this.toSummary(row));
  }

  async get(ownerId: string, playlistId: string): Promise<Playlist | null> {
    const client = await this.pool.connect();
    try {
      return await this.readPlaylist(client, ownerId, playlistId);
    } finally {
      client.release();
    }
  }

  async create(ownerId: string, name: string): Promise<Playlist> {
    return this.withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`owner:${ownerId}`]);
      const count = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM playlists WHERE owner_id = $1',
        [ownerId],
      );
      if (Number(count.rows[0]?.count ?? 0) >= this.config.MAX_PLAYLISTS_PER_OWNER) {
        throw new HttpError(409, 'playlist_limit_reached', 'Alcanzaste el límite de playlists.');
      }
      const inserted = await client.query<PlaylistRow>(
        'INSERT INTO playlists (owner_id, name) VALUES ($1, $2) RETURNING id, name, revision, created_at, updated_at',
        [ownerId, name.trim()],
      );
      const row = inserted.rows[0];
      if (!row) throw new Error('Playlist insert did not return a row.');
      return this.toPlaylist(row, []);
    });
  }

  async rename(ownerId: string, playlistId: string, name: string): Promise<Playlist> {
    return this.withTransaction(async (client) => {
      const playlist = await this.lockOwnedPlaylist(client, ownerId, playlistId);
      await client.query(
        'UPDATE playlists SET name = $1, revision = revision + 1, updated_at = now() WHERE id = $2',
        [name.trim(), playlist.id],
      );
      return this.requirePlaylist(client, ownerId, playlistId);
    });
  }

  async delete(ownerId: string, playlistId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM playlists WHERE id = $1 AND owner_id = $2', [
      playlistId,
      ownerId,
    ]);
    return result.rowCount === 1;
  }

  async addTrack(
    ownerId: string,
    playlistId: string,
    input: {
      at: { mode: 'head' } | { mode: 'tail' } | { mode: 'index'; index: number };
      expectedRevision: number;
    },
    source: ResolvedCatalogTrack,
  ): Promise<Playlist> {
    return this.withTransaction(async (client) => {
      const playlist = await this.lockOwnedPlaylist(client, ownerId, playlistId);
      this.assertRevision(playlist.revision, input.expectedRevision);
      const list = await this.loadTrackList(client, playlistId);
      if (list.size >= this.config.MAX_TRACKS_PER_PLAYLIST) {
        throw new HttpError(
          409,
          'track_limit_reached',
          'Esta playlist alcanzó el límite de canciones.',
        );
      }
      if (input.at.mode === 'index' && input.at.index > list.size) {
        throw new HttpError(
          400,
          'validation_error',
          'La posición debe estar entre 0 y la cantidad de pistas.',
          {
            index: input.at.index,
            size: list.size,
          },
        );
      }

      const track: Track = {
        id: randomUUID(),
        playlistId,
        position: 0,
        provider: source.provider,
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        title: source.title.trim().slice(0, 200),
        artist: source.artist?.trim() || null,
        durationSec: source.durationSec ?? null,
        thumbnailUrl: source.thumbnailUrl ?? null,
        attributionUrl: source.attributionUrl ?? null,
        licenseUrl: source.licenseUrl ?? null,
        available: true,
      };
      const index =
        input.at.mode === 'head' ? 0 : input.at.mode === 'tail' ? list.size : input.at.index;
      list.insertAt(index, track.id, track);
      await client.query(
        `INSERT INTO tracks (id, playlist_id, position, provider, source_id, source_url, title, artist, duration_sec, thumbnail_url, attribution_url, license_url)
         VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          track.id,
          playlistId,
          track.provider,
          track.sourceId,
          track.sourceUrl,
          track.title,
          track.artist,
          track.durationSec,
          track.thumbnailUrl,
          track.attributionUrl,
          track.licenseUrl,
        ],
      );
      await this.persistOrder(client, list, playlistId);
      await this.incrementRevision(client, playlistId);
      return this.requirePlaylist(client, ownerId, playlistId);
    });
  }

  async removeTrack(
    ownerId: string,
    playlistId: string,
    trackId: string,
    expectedRevision: number,
  ): Promise<Playlist> {
    return this.withTransaction(async (client) => {
      const playlist = await this.lockOwnedPlaylist(client, ownerId, playlistId);
      this.assertRevision(playlist.revision, expectedRevision);
      const list = await this.loadTrackList(client, playlistId);
      if (!list.removeById(trackId))
        throw new HttpError(404, 'not_found', 'No se encontró la canción.');
      await client.query('DELETE FROM tracks WHERE id = $1 AND playlist_id = $2', [
        trackId,
        playlistId,
      ]);
      await this.persistOrder(client, list, playlistId);
      await this.incrementRevision(client, playlistId);
      return this.requirePlaylist(client, ownerId, playlistId);
    });
  }

  async moveTrack(
    ownerId: string,
    playlistId: string,
    trackId: string,
    toIndex: number,
    expectedRevision: number,
  ): Promise<Playlist> {
    return this.withTransaction(async (client) => {
      const playlist = await this.lockOwnedPlaylist(client, ownerId, playlistId);
      this.assertRevision(playlist.revision, expectedRevision);
      const list = await this.loadTrackList(client, playlistId);
      const fromIndex = list.indexOf(trackId);
      if (fromIndex < 0) throw new HttpError(404, 'not_found', 'No se encontró la canción.');
      if (toIndex >= list.size) {
        throw new HttpError(400, 'validation_error', 'La posición de destino no existe.', {
          toIndex,
          size: list.size,
        });
      }
      if (fromIndex === toIndex) return this.requirePlaylist(client, ownerId, playlistId);
      list.moveTo(trackId, toIndex);
      await this.persistOrder(client, list, playlistId);
      await this.incrementRevision(client, playlistId);
      return this.requirePlaylist(client, ownerId, playlistId);
    });
  }

  private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockOwnedPlaylist(
    client: PoolClient,
    ownerId: string,
    playlistId: string,
  ): Promise<PlaylistRow> {
    const result = await client.query<PlaylistRow>(
      'SELECT id, name, revision, created_at, updated_at FROM playlists WHERE id = $1 AND owner_id = $2 FOR UPDATE',
      [playlistId, ownerId],
    );
    const playlist = result.rows[0];
    if (!playlist) throw new HttpError(404, 'not_found', 'No se encontró la playlist.');
    return playlist;
  }

  private async loadTrackList(
    client: PoolClient,
    playlistId: string,
  ): Promise<DoublyLinkedList<Track>> {
    const result = await client.query<TrackRow>(
      `SELECT id, playlist_id, position, provider, source_id, source_url, title, artist, duration_sec, thumbnail_url, attribution_url, license_url
         FROM tracks WHERE playlist_id = $1 ORDER BY position FOR UPDATE`,
      [playlistId],
    );
    return DoublyLinkedList.from(
      result.rows.map((row) => ({ id: row.id, value: this.toTrack(row) })),
    );
  }

  private async persistOrder(
    client: PoolClient,
    list: DoublyLinkedList<Track>,
    playlistId: string,
  ): Promise<void> {
    const ids: string[] = [];
    const positions: number[] = [];
    for (let node = list.head, position = 0; node; node = node.next, position += 1) {
      ids.push(node.id);
      positions.push(position);
    }
    if (ids.length === 0) return;

    await client.query(
      `UPDATE tracks AS track
          SET position = position_update.position
         FROM unnest($1::uuid[], $2::integer[]) AS position_update(id, position)
        WHERE track.id = position_update.id AND track.playlist_id = $3`,
      [ids, positions, playlistId],
    );
  }

  private async incrementRevision(client: PoolClient, playlistId: string): Promise<void> {
    await client.query(
      'UPDATE playlists SET revision = revision + 1, updated_at = now() WHERE id = $1',
      [playlistId],
    );
  }

  private async requirePlaylist(
    client: PoolClient,
    ownerId: string,
    playlistId: string,
  ): Promise<Playlist> {
    const playlist = await this.readPlaylist(client, ownerId, playlistId);
    if (!playlist) throw new HttpError(404, 'not_found', 'No se encontró la playlist.');
    return playlist;
  }

  private async readPlaylist(
    client: PoolClient,
    ownerId: string,
    playlistId: string,
  ): Promise<Playlist | null> {
    const result = await client.query<PlaylistRow>(
      'SELECT id, name, revision, created_at, updated_at FROM playlists WHERE id = $1 AND owner_id = $2',
      [playlistId, ownerId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const tracks = await this.loadTrackList(client, playlistId);
    return this.toPlaylist(row, tracks.toArray());
  }

  private assertRevision(actual: number, expected: number): void {
    if (actual !== expected) {
      throw new HttpError(
        409,
        'revision_conflict',
        'La playlist cambió en otra pestaña. Actualiza para continuar.',
        {
          expectedRevision: expected,
          actualRevision: actual,
        },
      );
    }
  }

  private toSummary(row: PlaylistRow): PlaylistSummary {
    return {
      id: row.id,
      name: row.name,
      revision: row.revision,
      trackCount: Number(row.track_count ?? 0),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toPlaylist(row: PlaylistRow, tracks: Track[]): Playlist {
    return {
      id: row.id,
      name: row.name,
      revision: row.revision,
      trackCount: tracks.length,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      tracks,
    };
  }

  private toTrack(row: TrackRow): Track {
    return {
      id: row.id,
      playlistId: row.playlist_id,
      position: row.position,
      provider: row.provider,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      title: row.title,
      artist: row.artist,
      durationSec: row.duration_sec,
      thumbnailUrl: row.thumbnail_url,
      attributionUrl: row.attribution_url,
      licenseUrl: row.license_url,
      available: true,
    };
  }
}
