import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Signer } from '@aws-sdk/rds-signer';
import { Pool } from 'pg';
import type { AppConfig } from './config.js';

export function createPool(config: AppConfig): Pool {
  const connection = config.DATABASE_URL
    ? { connectionString: config.DATABASE_URL }
    : (() => {
        const signer = new Signer({
          hostname: config.PGHOST!,
          port: config.PGPORT,
          username: config.PGUSER!,
          region: config.AWS_REGION!,
        });
        return {
          host: config.PGHOST!,
          port: config.PGPORT,
          database: config.PGDATABASE!,
          user: config.PGUSER!,
          password: () => signer.getAuthToken(),
          ssl: { rejectUnauthorized: true },
        };
      })();

  return new Pool({
    ...connection,
    max: process.env.VERCEL === '1' ? 1 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'reproductor-estructuras-datos',
  });
}

export async function migrate(
  pool: Pool,
  bundledMigrations?: Readonly<Record<string, string>>,
): Promise<void> {
  let migrationsDirectory: string | undefined;
  let migrations: string[];
  if (bundledMigrations) {
    migrations = Object.keys(bundledMigrations)
      .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
      .sort();
  } else {
    const migrationsUrl = new URL('../migrations/', import.meta.url);
    migrationsDirectory = fileURLToPath(migrationsUrl);
    migrations = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
      .sort();
  }
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
    for (const migration of migrations) {
      const version = migration.slice(0, -'.sql'.length);
      const result = await client.query<{ version: string }>(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version],
      );
      if (result.rowCount === 0) {
        const migrationSql = bundledMigrations
          ? bundledMigrations[migration]
          : migrationsDirectory
            ? await readFile(join(migrationsDirectory, migration), 'utf8')
            : undefined;
        if (migrationSql === undefined) throw new Error(`Migration ${migration} is missing.`);
        await client.query(migrationSql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
