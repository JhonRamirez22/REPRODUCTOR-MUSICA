import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { Pool } from 'pg';
import type { AppConfig } from './config.js';
import { HttpError } from './errors.js';
import { healthRoutes } from './routes/health.js';
import { catalogRoutes } from './routes/catalog.js';
import { playlistRoutes } from './routes/playlists.js';
import { JamendoService } from './services/jamendo-service.js';
import { YtMusicService } from './services/ytmusic-service.js';
import { PlaylistService } from './services/playlist-service.js';

export interface BuildAppOptions {
  config: AppConfig;
  pool: Pool;
  catalog?: YtMusicService;
  legacyJamendo?: JamendoService;
}

export async function buildApp({
  config,
  pool,
  catalog = new YtMusicService(config.YTMUSIC_PYTHON),
  legacyJamendo = new JamendoService(config.JAMENDO_CLIENT_ID),
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
    trustProxy: true,
    bodyLimit: config.BODY_LIMIT_BYTES,
  });
  const playlistService = new PlaylistService(pool, config);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: 'Revisa los datos enviados.',
          details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
      });
    }
    if (typeof error === 'object' && error !== null && 'validation' in error && error.validation) {
      return reply
        .code(400)
        .send({ error: { code: 'validation_error', message: 'Revisa los datos enviados.' } });
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      const statusCode = error.statusCode;
      if (statusCode === 400) {
        return reply
          .code(400)
          .send({ error: { code: 'validation_error', message: 'Revisa los datos enviados.' } });
      }
      if (statusCode === 413) {
        return reply.code(413).send({
          error: {
            code: 'payload_too_large',
            message: 'La solicitud supera el tamaño máximo permitido.',
          },
        });
      }
    }
    request.log.error({ err: error }, 'Request failed');
    return reply.code(500).send({
      error: { code: 'internal_error', message: 'Ocurrió un error. Inténtalo de nuevo.' },
    });
  });

  await app.register(cookie, { secret: config.COOKIE_SECRET });
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://www.youtube.com', 'https://s.ytimg.com'],
        frameSrc: ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        imgSrc: [
          "'self'",
          'data:',
          'https://i.ytimg.com',
          'https://lh3.googleusercontent.com',
          'https://yt3.googleusercontent.com',
          'https://yt3.ggpht.com',
        ],
        mediaSrc: ['https:'],
        connectSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: { code: 'rate_limit_exceeded', message: 'Demasiadas solicitudes. Espera un momento.' },
    }),
  });
  await app.register(healthRoutes, { prefix: '/api', pool });
  await app.register(catalogRoutes, {
    prefix: '/api',
    service: catalog,
    legacyJamendo,
    legacyJamendoEnabled: Boolean(config.JAMENDO_CLIENT_ID),
  });
  await app.register(playlistRoutes, {
    prefix: '/api',
    service: playlistService,
    catalog,
    config,
  });

  const webRootUrl = new URL('../../web/dist/', import.meta.url);
  const webRoot = fileURLToPath(webRootUrl);
  try {
    await access(fileURLToPath(new URL('index.html', webRootUrl)));
    await app.register(fastifyStatic, { root: webRoot, prefix: '/' });
    app.get('/', async (_request, reply) => reply.sendFile('index.html'));
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply
          .code(404)
          .send({ error: { code: 'not_found', message: 'No se encontró la ruta.' } });
      }
      return reply.type('text/html').sendFile('index.html');
    });
  } catch {
    app.setNotFoundHandler((_request, reply) =>
      reply.code(404).send({ error: { code: 'not_found', message: 'No se encontró la ruta.' } }),
    );
  }

  return app;
}
