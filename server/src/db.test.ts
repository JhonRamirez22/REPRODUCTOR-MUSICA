import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { createPool } from './db.js';

describe('createPool', () => {
  it('uses TLS and requests a fresh IAM token for Aurora connections', async () => {
    const pool = createPool(
      loadConfig({
        COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
        PGHOST: 'cluster.example.rds.amazonaws.com',
        PGDATABASE: 'reproductor',
        PGUSER: 'postgres',
        AWS_REGION: 'us-east-1',
      }),
    );

    try {
      expect(pool.options).toMatchObject({
        host: 'cluster.example.rds.amazonaws.com',
        port: 5432,
        database: 'reproductor',
        user: 'postgres',
        ssl: { rejectUnauthorized: true },
      });
      expect(pool.options.password).toBeTypeOf('function');
    } finally {
      await pool.end();
    }
  });
});
