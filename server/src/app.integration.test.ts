import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './db.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const enabled = Boolean(testDatabaseUrl);
const pool = enabled ? new Pool({ connectionString: testDatabaseUrl, max: 2 }) : null;
let app: FastifyInstance | null = null;
let createdPlaylistId: string | null = null;

describe.skipIf(!enabled)('Playlist API with PostgreSQL', () => {
  beforeAll(async () => {
    if (pool) await migrate(pool);
  });

  afterEach(async () => {
    if (app) await app.close();
    app = null;
    if (pool && createdPlaylistId) {
      await pool.query('DELETE FROM playlists WHERE id = $1', [createdPlaylistId]);
    }
    createdPlaylistId = null;
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('keeps CRUD, insertion positions, ownership, and revision conflicts coherent over HTTP', async () => {
    if (!pool || !testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    app = await buildApp({
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: testDatabaseUrl,
        COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
      }),
      pool,
    });

    const created = await app.inject({
      method: 'POST',
      url: '/api/playlists',
      payload: { name: 'Prueba API de extremo a extremo' },
    });
    expect(created.statusCode).toBe(201);
    const playlist = created.json<{ id: string; revision: number }>();
    createdPlaylistId = playlist.id;
    const setCookie = created.headers['set-cookie'];
    if (!setCookie) throw new Error('The owner cookie was not created.');
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0];
    if (!cookie) throw new Error('The owner cookie is empty.');

    const listed = await app.inject({ method: 'GET', url: '/api/playlists', headers: { cookie } });
    expect(listed.json()).toMatchObject([
      { id: playlist.id, name: 'Prueba API de extremo a extremo' },
    ]);

    const foreign = await app.inject({ method: 'GET', url: `/api/playlists/${playlist.id}` });
    expect(foreign.statusCode).toBe(404);

    const emptyJsonBody = await app.inject({
      method: 'DELETE',
      url: `/api/playlists/${playlist.id}/tracks/00000000-0000-4000-8000-000000000002?expectedRevision=0`,
      headers: { cookie, 'content-type': 'application/json' },
    });
    expect(emptyJsonBody.statusCode).toBe(400);
    expect(emptyJsonBody.json()).toMatchObject({ error: { code: 'validation_error' } });

    const invalidPosition = await app.inject({
      method: 'POST',
      url: `/api/playlists/${playlist.id}/tracks`,
      headers: { cookie },
      payload: {
        url: 'https://cdn.example.org/primera.mp3',
        at: { mode: 'index', index: 1 },
        expectedRevision: 0,
      },
    });
    expect(invalidPosition.statusCode).toBe(400);

    const first = await app.inject({
      method: 'POST',
      url: `/api/playlists/${playlist.id}/tracks`,
      headers: { cookie },
      payload: {
        url: 'https://cdn.example.org/primera.mp3',
        at: { mode: 'tail' },
        expectedRevision: 0,
      },
    });
    expect(first.statusCode).toBe(201);
    const firstResult = first.json<{ tracks: Array<{ id: string; title: string }> }>();
    expect(firstResult.tracks.map((track) => track.title)).toEqual(['primera']);

    const staleWrite = await app.inject({
      method: 'POST',
      url: `/api/playlists/${playlist.id}/tracks`,
      headers: { cookie },
      payload: {
        url: 'https://cdn.example.org/segunda.mp3',
        at: { mode: 'tail' },
        expectedRevision: 0,
      },
    });
    expect(staleWrite.statusCode).toBe(409);
    expect(staleWrite.json()).toMatchObject({ error: { code: 'revision_conflict' } });

    const second = await app.inject({
      method: 'POST',
      url: `/api/playlists/${playlist.id}/tracks`,
      headers: { cookie },
      payload: {
        url: 'https://cdn.example.org/segunda.mp3',
        at: { mode: 'head' },
        expectedRevision: 1,
      },
    });
    expect(second.statusCode).toBe(201);
    const secondResult = second.json<{
      revision: number;
      tracks: Array<{ id: string; title: string }>;
    }>();
    expect(secondResult.revision).toBe(2);
    expect(secondResult.tracks.map((track) => track.title)).toEqual(['segunda', 'primera']);

    const moved = await app.inject({
      method: 'PATCH',
      url: `/api/playlists/${playlist.id}/tracks/${firstResult.tracks[0]?.id}/move`,
      headers: { cookie },
      payload: { toIndex: 0, expectedRevision: 2 },
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json()).toMatchObject({
      revision: 3,
      tracks: [{ title: 'primera' }, { title: 'segunda' }],
    });

    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/playlists/${playlist.id}`,
      headers: { cookie },
      payload: { name: '  Playlist actualizada  ' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ name: 'Playlist actualizada', revision: 4 });

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/playlists/${playlist.id}/tracks/${firstResult.tracks[0]?.id}?expectedRevision=4`,
      headers: { cookie },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toMatchObject({ trackCount: 1, revision: 5 });

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/playlists/${playlist.id}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(204);
    createdPlaylistId = null;
    const missing = await app.inject({
      method: 'GET',
      url: `/api/playlists/${playlist.id}`,
      headers: { cookie },
    });
    expect(missing.statusCode).toBe(404);
  });
});
