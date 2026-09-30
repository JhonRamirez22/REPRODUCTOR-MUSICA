import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';

export const healthRoutes: FastifyPluginAsync<{ pool: Pool }> = async (app, { pool }) => {
  app.get('/health', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
};
