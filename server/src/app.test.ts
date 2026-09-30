import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { JamendoService } from './services/jamendo-service.js';

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
  it('exposes catalog configuration without returning its credentials', async () => {
    app = await buildApp({
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
        COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
        RATE_LIMIT_MAX: '120',
        JAMENDO_CLIENT_ID: 'server-only-client-id',
      }),
      pool,
      jamendo: new JamendoService('server-only-client-id', async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/file/')) {
          return new Response(null, {
            status: 302,
            headers: { location: 'https://prod-1.storage.jamendo.com/?trackid=1848357' },
          });
        }
        return new Response(
          JSON.stringify({
            headers: { status: 'success', code: 0, error_message: '' },
            results: [
              {
                id: '1848357',
                name: 'Mañana será tarde',
                artist_name: 'Fankel',
                duration: 272,
                image: 'https://usercontent.jamendo.com/cover.jpg',
                license_ccurl: 'http://creativecommons.org/licenses/by-nc-nd/3.0/',
              },
            ],
          }),
          { status: 200 },
        );
      }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/catalog/status',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ enabled: true });
    expect(response.body).not.toContain('server-only-client-id');

    const search = await app.inject({ method: 'GET', url: '/api/catalog/search?q=Fankel' });
    expect(search.statusCode).toBe(200);
    expect(search.json()).toMatchObject({
      tracks: [{ id: '1848357', title: 'Mañana será tarde', artist: 'Fankel' }],
    });
    expect(search.body).not.toContain('server-only-client-id');

    const stream = await app.inject({ method: 'GET', url: '/api/catalog/stream/1848357' });
    expect(stream.statusCode).toBe(302);
    expect(stream.headers.location).toBe('https://prod-1.storage.jamendo.com/?trackid=1848357');
    expect(stream.body).not.toContain('server-only-client-id');
  });

  it('reports a clear configuration error when the catalog is unavailable', async () => {
    app = await buildApp({
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
        COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
      }),
      pool,
    });

    const response = await app.inject({ method: 'GET', url: '/api/catalog/search?q=ambient' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: {
        code: 'catalog_not_configured',
        message: expect.stringContaining('JAMENDO_CLIENT_ID'),
      },
    });
    expect(response.body).not.toContain('stack');
  });
});
