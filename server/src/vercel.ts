import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool, migrate } from './db.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config);
  try {
    await migrate(pool);
    const app = await buildApp({ config, pool });
    await app.listen({ host: '0.0.0.0', port: config.PORT });
  } catch (error) {
    await pool.end();
    throw error;
  }
}

await start();
