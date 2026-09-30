import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { JamendoService } from '../services/jamendo-service.js';

const SearchQuerySchema = z.object({ q: z.string().trim().min(2).max(100) });
const TrackParamsSchema = z.object({ trackId: z.string().regex(/^\d{1,20}$/) });

export const catalogRoutes: FastifyPluginAsync<{
  service: JamendoService;
  enabled: boolean;
}> = async (app, { service, enabled }) => {
  app.get('/catalog/status', async () => ({ enabled }));

  app.get(
    '/catalog/search',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const { q } = SearchQuerySchema.parse(request.query);
      return { tracks: await service.search(q) };
    },
  );

  app.get(
    '/catalog/stream/:trackId',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { trackId } = TrackParamsSchema.parse(request.params);
      if (!enabled) {
        throw new HttpError(
          503,
          'catalog_not_configured',
          'El catálogo necesita una credencial JAMENDO_CLIENT_ID en el servidor.',
        );
      }
      const streamUrl = await service.getStreamRedirect(trackId);
      return reply.redirect(streamUrl, 302);
    },
  );
};
