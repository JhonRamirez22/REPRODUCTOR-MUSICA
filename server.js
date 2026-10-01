import Fastify from 'fastify';
import { buildApp } from './server/dist/app.js';
import { loadConfig } from './server/dist/config.js';
import { createPool, migrate } from './server/dist/db.js';
import { bundledMigrations, webAssets } from './server/dist/vercel-bundle.js';

const config = loadConfig();
const pool = createPool(config);
const app = Fastify({
  logger: config.NODE_ENV !== 'test',
  trustProxy: true,
  bodyLimit: config.BODY_LIMIT_BYTES,
});

try {
  await migrate(pool, bundledMigrations);
  await buildApp({ config, pool, instance: app, webAssets });
  await app.listen({ host: '0.0.0.0', port: config.PORT });
} catch (error) {
  await pool.end();
  throw error;
}
