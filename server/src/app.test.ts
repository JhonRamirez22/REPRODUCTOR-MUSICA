import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { MetadataService } from './services/metadata-service.js';

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
  it('returns preview metadata through inject without contacting YouTube', async () => {
    const metadata = new MetadataService(
      async () =>
        new Response(JSON.stringify({ title: 'Vista previa' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    app = await buildApp({
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
        COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
        RATE_LIMIT_MAX: '120',
      }),
      pool,
      metadata,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/resolve',
      payload: { url: 'https://youtu.be/a1B2c3D4e5F' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ title: 'Vista previa', provider: 'youtube' });
  });

  it('returns a stable validation envelope for unsupported sources', async () => {
    app = await buildApp({
      config: loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
        COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
      }),
      pool,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/resolve',
      payload: { url: 'javascript:alert(1)' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'unsupported_scheme', message: expect.any(String) },
    });
    expect(response.body).not.toContain('stack');
  });
});
