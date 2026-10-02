import { AuthCredentialsSchema } from '@reproductor/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../config.js';
import type { AuthService } from '../services/auth-service.js';

interface AuthRouteOptions {
  service: AuthService;
  config: AppConfig;
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (
  app,
  { service, config },
) => {
  const secureCookie = config.NODE_ENV === 'production';
  app.get('/auth/session', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return { user: await service.sessionUser(request, reply, secureCookie) };
  });

  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const credentials = AuthCredentialsSchema.parse(request.body);
      const user = await service.register(request, reply, credentials, secureCookie);
      return reply.header('cache-control', 'no-store').code(201).send({ user });
    },
  );

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const credentials = AuthCredentialsSchema.parse(request.body);
      const user = await service.login(reply, credentials, secureCookie);
      return reply.header('cache-control', 'no-store').send({ user });
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    await service.logout(request, reply, secureCookie);
    return reply.header('cache-control', 'no-store').code(204).send();
  });
};
