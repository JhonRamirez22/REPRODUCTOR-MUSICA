import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool, migrate } from './db.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config);
  let app: Awaited<ReturnType<typeof buildApp>> | null = null;

  try {
    await migrate(pool);
    app = await buildApp({ config, pool });
    await app.listen({ host: '0.0.0.0', port: config.PORT });
  } catch (error) {
    if (app) await app.close();
    await pool.end();
    throw error;
  }

  let closing = false;
  const close = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    await app?.close();
    await pool.end();
  };
  process.once('SIGTERM', () => void close());
  process.once('SIGINT', () => void close());
}

start().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Server startup failed'}\n`);
  process.exitCode = 1;
});
