import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import type { AppConfig } from './config.js';

export function createPool(config: AppConfig): Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'reproductor-estructuras-datos',
  });
}

export async function migrate(pool: Pool): Promise<void> {
  const migrationUrl = new URL('../migrations/001_init.sql', import.meta.url);
  const migrationSql = await readFile(fileURLToPath(migrationUrl), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('reproductor-schema-migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const result = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = $1',
      ['001_init'],
    );
    if (result.rowCount === 0) {
      await client.query(migrationSql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', ['001_init']);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
