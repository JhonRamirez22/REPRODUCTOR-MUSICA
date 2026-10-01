import { buildApp } from './server/dist/app.js';
import { loadConfig } from './server/dist/config.js';
import { createPool, migrate } from './server/dist/db.js';
import { bundledMigrations, webAssets } from './server/dist/vercel-bundle.js';

const config = loadConfig();
const pool = createPool(config);

try {
  await migrate(pool, bundledMigrations);
  const app = await buildApp({ config, pool, webAssets });
  await app.listen({ host: '0.0.0.0', port: config.PORT });
} catch (error) {
  await pool.end();
  throw error;
}
