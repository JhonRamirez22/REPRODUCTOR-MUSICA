import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { YtMusicService } from './services/ytmusic-service.js';

const pool = new Pool({
  connectionString: 'postgres://test:test@127.0.0.1:1/test',
  connectionTimeoutMillis: 50,
  max: 1,
});
let app: FastifyInstance | null = null;

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

afterAll(async () => {
  await pool.end();
});

describe('Fastify API', () => {
  it('exposes the public YouTube Music catalog and verifies selections server-side', async () => {
    app = await buildApp({
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
        COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
      }),
      pool,
      catalog: new YtMusicService('python3', async ({ action }) =>
        action === 'check'
          ? { ready: true }
          : [
              {
                videoId: 'dQw4w9WgXcQ',
                title: 'Mañana será tarde',
                artist: 'Fankel',
                durationSec: 272,
                thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
              },
            ],
      ),
    });

    const status = await app.inject({ method: 'GET', url: '/api/catalog/status' });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ enabled: true });

    const search = await app.inject({ method: 'GET', url: '/api/catalog/search?q=Fankel' });
    expect(search.statusCode).toBe(200);
    expect(search.json()).toMatchObject({
      tracks: [{ id: 'dQw4w9WgXcQ', title: 'Mañana será tarde', artist: 'Fankel' }],
    });

    const forgedSelection = await app.inject({
      method: 'POST',
      url: '/api/playlists/00000000-0000-4000-8000-000000000001/tracks',
      payload: {
        query: 'Fankel',
        videoId: 'aaaaaaaaaaa',
        at: { mode: 'tail' },
        expectedRevision: 0,
      },
    });
    expect(forgedSelection.statusCode).toBe(404);
    expect(forgedSelection.json()).toMatchObject({
      error: { code: 'catalog_track_not_found' },
    });

    const pastedLink = await app.inject({
      method: 'POST',
      url: '/api/playlists/00000000-0000-4000-8000-000000000001/tracks',
      payload: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        at: { mode: 'tail' },
        expectedRevision: 0,
      },
    });
    expect(pastedLink.statusCode).toBe(400);
    expect(pastedLink.json()).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('reports a clear dependency error when the catalog runtime is unavailable', async () => {
    app = await buildApp({
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
        COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
      }),
      pool,
      catalog: new YtMusicService('python3', async () => {
        throw new Error('missing runtime');
      }),
    });

    const response = await app.inject({ method: 'GET', url: '/api/catalog/search?q=ambient' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: {
        code: 'catalog_not_configured',
        message: expect.stringContaining('Python'),
      },
    });
    expect(response.body).not.toContain('stack');
  });
});
