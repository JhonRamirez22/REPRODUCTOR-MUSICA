import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { migrate } from '../db.js';
import { PlaylistService } from './playlist-service.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const enabled = Boolean(testDatabaseUrl);
const pool = enabled ? new Pool({ connectionString: testDatabaseUrl, max: 2 }) : null;
const service = pool
  ? new PlaylistService(pool, { MAX_PLAYLISTS_PER_OWNER: 50, MAX_TRACKS_PER_PLAYLIST: 500 })
  : null;

describe.skipIf(!enabled)('PlaylistService with PostgreSQL', () => {
  beforeAll(async () => {
    if (pool) await migrate(pool);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('persists insert positions, moves, removals, ownership, and revision conflicts', async () => {
    if (!service) throw new Error('TEST_DATABASE_URL is required.');
    const ownerId = randomUUID();
    const otherOwnerId = randomUUID();
    const playlist = await service.create(ownerId, 'Prueba de integración');
    try {
      const source = (title: string) => ({
        provider: 'jamendo' as const,
        sourceId: title === 'Primera' ? '101' : title === 'Segunda' ? '102' : '103',
        sourceUrl: `https://www.jamendo.com/track/${title === 'Primera' ? '101' : title === 'Segunda' ? '102' : '103'}`,
        title,
        artist: 'Artista de prueba',
        attributionUrl: `https://www.jamendo.com/track/${title === 'Primera' ? '101' : title === 'Segunda' ? '102' : '103'}`,
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      });
      const first = await service.addTrack(
        ownerId,
        playlist.id,
        {
          at: { mode: 'tail' },
          expectedRevision: 0,
        },
        source('Primera'),
      );
      const second = await service.addTrack(
        ownerId,
        playlist.id,
        {
          at: { mode: 'head' },
          expectedRevision: 1,
        },
        source('Segunda'),
      );
      const third = await service.addTrack(
        ownerId,
        playlist.id,
        {
          at: { mode: 'index', index: 1 },
          expectedRevision: 2,
        },
        source('Tercera'),
      );

      expect(third.tracks?.map((track) => track.title)).toEqual(['Segunda', 'Tercera', 'Primera']);
      expect(await service.get(otherOwnerId, playlist.id)).toBeNull();
      await expect(
        service.addTrack(
          ownerId,
          playlist.id,
          {
            at: { mode: 'index', index: 5 },
            expectedRevision: 3,
          },
          source('Inválida'),
        ),
      ).rejects.toMatchObject({ statusCode: 400, code: 'validation_error' });
      await expect(
        service.removeTrack(ownerId, playlist.id, first.tracks?.[0]?.id ?? '', 0),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'revision_conflict',
      });

      const firstTrackId = third.tracks?.[0]?.id;
      if (!firstTrackId) throw new Error('Expected a persisted track.');
      const samePosition = await service.moveTrack(ownerId, playlist.id, firstTrackId, 0, 3);
      expect(samePosition.revision).toBe(3);

      const moved = await service.moveTrack(ownerId, playlist.id, firstTrackId, 2, 3);
      expect(moved.revision).toBe(4);
      expect(moved.tracks?.map((track) => track.title)).toEqual(['Tercera', 'Primera', 'Segunda']);

      const removed = await service.removeTrack(
        ownerId,
        playlist.id,
        second.tracks?.[0]?.id ?? '',
        4,
      );
      expect(removed.tracks?.map((track) => track.title)).toEqual(['Tercera', 'Primera']);
      expect(removed.revision).toBe(5);
      const oneLeft = await service.removeTrack(
        ownerId,
        playlist.id,
        removed.tracks?.[0]?.id ?? '',
        5,
      );
      const empty = await service.removeTrack(
        ownerId,
        playlist.id,
        oneLeft.tracks?.[0]?.id ?? '',
        6,
      );
      expect(empty.trackCount).toBe(0);
      expect(empty.tracks).toEqual([]);
    } finally {
      await service.delete(ownerId, playlist.id);
    }
  });

  it('returns 404 for a missing track and enforces the track cap', async () => {
    if (!pool) throw new Error('TEST_DATABASE_URL is required.');
    const ownerId = randomUUID();
    const limited = new PlaylistService(pool, {
      MAX_PLAYLISTS_PER_OWNER: 1,
      MAX_TRACKS_PER_PLAYLIST: 1,
    });
    const playlist = await limited.create(ownerId, 'Límite');
    try {
      await expect(limited.create(ownerId, 'Otra')).rejects.toMatchObject({
        statusCode: 409,
        code: 'playlist_limit_reached',
      });
      await expect(
        limited.removeTrack(ownerId, playlist.id, randomUUID(), 0),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'not_found',
      });
      const source = {
        provider: 'jamendo' as const,
        sourceId: '101',
        sourceUrl: 'https://www.jamendo.com/track/101',
        title: 'Una pista',
        artist: 'Artista de prueba',
        attributionUrl: 'https://www.jamendo.com/track/101',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      };
      await limited.addTrack(
        ownerId,
        playlist.id,
        { at: { mode: 'tail' }, expectedRevision: 0 },
        source,
      );
      await expect(
        limited.addTrack(
          ownerId,
          playlist.id,
          {
            at: { mode: 'tail' },
            expectedRevision: 1,
          },
          source,
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: 'track_limit_reached' });
    } finally {
      await limited.delete(ownerId, playlist.id);
    }
  });
});
