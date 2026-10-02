import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PlaylistService } from './playlist-service.js';

const playlistId = '00000000-0000-4000-8000-000000000100';
const ownerId = '00000000-0000-4000-8000-000000000101';
const firstTrackId = '00000000-0000-4000-8000-000000000102';
const secondTrackId = '00000000-0000-4000-8000-000000000103';
const createdAt = new Date('2026-01-01T00:00:00.000Z');

function trackRow(id: string, position: number, title: string) {
  return {
    id,
    playlist_id: playlistId,
    position,
    provider: 'youtube',
    source_id: `video-${position}`,
    source_url: `https://www.youtube.com/watch?v=video-${position}`,
    title,
    artist: 'Artista',
    duration_sec: 120,
    thumbnail_url: null,
    attribution_url: null,
    license_url: null,
    created_at: createdAt,
  };
}

describe('PlaylistService position persistence', () => {
  it('persists an insertion reorder with one parameterized database update', async () => {
    const tracks = [trackRow(firstTrackId, 0, 'Primera'), trackRow(secondTrackId, 1, 'Segunda')];
    let revision = 2;
    const query = vi.fn(async (sql: string, values: unknown[] = []) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM playlists') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: playlistId,
              name: 'Prueba',
              revision,
              created_at: createdAt,
              updated_at: createdAt,
            },
          ],
        };
      }
      if (sql.startsWith('SELECT id, playlist_id')) {
        return { rows: [...tracks].sort((left, right) => left.position - right.position) };
      }
      if (sql.startsWith('INSERT INTO tracks')) {
        const [id, insertedPlaylistId, provider, sourceId, sourceUrl, title] = values as [
          string,
          string,
          string,
          string,
          string,
          string,
        ];
        tracks.push({
          ...trackRow(id, 0, title),
          playlist_id: insertedPlaylistId,
          provider,
          source_id: sourceId,
          source_url: sourceUrl,
        });
        return { rows: [] };
      }
      if (sql.includes('FROM unnest')) {
        const [ids, positions, updatedPlaylistId] = values as [string[], number[], string];
        ids.forEach((id, index) => {
          const row = tracks.find(
            (track) => track.id === id && track.playlist_id === updatedPlaylistId,
          );
          if (row) row.position = positions[index]!;
        });
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE tracks SET position')) {
        const [position, id] = values as [number, string];
        const row = tracks.find((track) => track.id === id);
        if (row) row.position = position;
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE playlists SET revision')) {
        revision += 1;
        return { rows: [] };
      }
      if (sql.includes('FROM playlists') && !sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: playlistId,
              name: 'Prueba',
              revision,
              created_at: createdAt,
              updated_at: createdAt,
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    const service = new PlaylistService(pool, {
      MAX_PLAYLISTS_PER_OWNER: 50,
      MAX_TRACKS_PER_PLAYLIST: 500,
    });

    const playlist = await service.addTrack(
      ownerId,
      playlistId,
      { at: { mode: 'head' }, expectedRevision: 2 },
      {
        provider: 'youtube',
        sourceId: 'new-video-id',
        sourceUrl: 'https://www.youtube.com/watch?v=new-video-id',
        title: 'Nueva',
        artist: 'Artista',
        durationSec: 120,
      },
    );

    const savedTracks = playlist.tracks ?? [];
    const positionWrites = query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE tracks'));
    expect(positionWrites).toHaveLength(1);
    expect(positionWrites[0]?.[0]).toContain('FROM unnest');
    expect(positionWrites[0]?.[1]).toEqual([
      [savedTracks[0]?.id, firstTrackId, secondTrackId],
      [0, 1, 2],
      playlistId,
    ]);
    expect(savedTracks.map((track) => track.title)).toEqual(['Nueva', 'Primera', 'Segunda']);
    expect(playlist.revision).toBe(3);
  });
});
