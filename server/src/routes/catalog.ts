import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { JamendoService } from '../services/jamendo-service.js';
import { YtMusicService } from '../services/ytmusic-service.js';

const SearchQuerySchema = z.object({ q: z.string().trim().min(2).max(100) });

export const catalogRoutes: FastifyPluginAsync<{
  service: YtMusicService;
  legacyJamendo: JamendoService;
  legacyJamendoEnabled: boolean;
}> = async (app, { service, legacyJamendo, legacyJamendoEnabled }) => {
  app.get('/catalog/status', async () => ({ enabled: await service.isAvailable() }));

  app.get(
    '/catalog/search',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const { q } = SearchQuerySchema.parse(request.query);
      if (!(await service.isAvailable())) {
        throw new HttpError(
          503,
          'catalog_not_configured',
          'Instala las dependencias de Python del servidor para activar el catálogo.',
        );
      }
      return { tracks: await service.search(q) };
    },
  );

  app.get(
    '/catalog/stream/:trackId',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { trackId } = z
        .object({ trackId: z.string().regex(/^\d{1,20}$/) })
        .parse(request.params);
      if (!legacyJamendoEnabled) {
        throw new HttpError(
          503,
          'legacy_catalog_unavailable',
          'La fuente anterior ya no está configurada.',
        );
      }
      const streamUrl = await legacyJamendo.getStreamRedirect(trackId);
      return reply.redirect(streamUrl, 302);
    },
  );
};
