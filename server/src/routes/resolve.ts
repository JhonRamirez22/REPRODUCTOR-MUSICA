import { ResolveRequestSchema } from '@reproductor/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { MetadataService } from '../services/metadata-service.js';

export const resolveRoutes: FastifyPluginAsync<{ metadata: MetadataService }> = async (
  app,
  { metadata },
) => {
  app.post(
    '/resolve',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const input = ResolveRequestSchema.parse(request.body);
      return metadata.resolve(input.url, input.allowExtensionless);
    },
  );
};
