import {
  AddTrackRequestSchema,
  CreatePlaylistRequestSchema,
  MoveTrackRequestSchema,
  RenamePlaylistRequestSchema,
  parseSourceUrl,
  type ResolvedTrackSource,
} from '@reproductor/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { HttpError } from '../errors.js';
import { ownerIdForRequest } from '../owner.js';
import type { MetadataService } from '../services/metadata-service.js';
import type { PlaylistService } from '../services/playlist-service.js';

const PlaylistParamsSchema = z.object({ playlistId: z.string().uuid() });
const TrackParamsSchema = PlaylistParamsSchema.extend({ trackId: z.string().uuid() });
const ExpectedRevisionSchema = z.object({
  expectedRevision: z.coerce.number().int().nonnegative(),
});

interface PlaylistRouteOptions {
  service: PlaylistService;
  metadata: MetadataService;
  config: AppConfig;
}

export const playlistRoutes: FastifyPluginAsync<PlaylistRouteOptions> = async (
  app,
  { service, metadata, config },
) => {
  app.get('/playlists', async (request, reply) => {
    const ownerId = ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    return service.list(ownerId);
  });

  app.post('/playlists', async (request, reply) => {
    const input = CreatePlaylistRequestSchema.parse(request.body);
    const ownerId = ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    const playlist = await service.create(ownerId, input.name);
    return reply.code(201).send(playlist);
  });

  app.get('/playlists/:playlistId', async (request, reply) => {
    const { playlistId } = PlaylistParamsSchema.parse(request.params);
    const ownerId = ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    const playlist = await service.get(ownerId, playlistId);
    if (!playlist) throw new HttpError(404, 'not_found', 'No se encontró la playlist.');
    return playlist;
  });

  app.patch('/playlists/:playlistId', async (request, reply) => {
    const { playlistId } = PlaylistParamsSchema.parse(request.params);
    const input = RenamePlaylistRequestSchema.parse(request.body);
    const ownerId = ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    return service.rename(ownerId, playlistId, input.name);
  });

  app.delete('/playlists/:playlistId', async (request, reply) => {
    const { playlistId } = PlaylistParamsSchema.parse(request.params);
    const ownerId = ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    const deleted = await service.delete(ownerId, playlistId);
    if (!deleted) throw new HttpError(404, 'not_found', 'No se encontró la playlist.');
    return reply.code(204).send();
  });

  app.post('/playlists/:playlistId/tracks', async (request, reply) => {
    const { playlistId } = PlaylistParamsSchema.parse(request.params);
    const input = AddTrackRequestSchema.parse(request.body);
    const ownerId = ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    const parsedSource = parseSourceUrl(input.url, input.allowExtensionless);
    let source: ResolvedTrackSource;
    if (input.resolved) {
      if (
        input.resolved.provider !== parsedSource.provider ||
        input.resolved.sourceId !== parsedSource.sourceId ||
        input.resolved.sourceUrl !== parsedSource.sourceUrl
      ) {
        throw new HttpError(400, 'validation_error', 'La vista previa no coincide con el enlace.');
      }
      source = input.resolved;
    } else {
      source = await metadata.resolve(input.url, input.allowExtensionless);
    }
    const playlist = await service.addTrack(ownerId, playlistId, input, source);
    return reply.code(201).send(playlist);
  });

  app.delete('/playlists/:playlistId/tracks/:trackId', async (request, reply) => {
    const { playlistId, trackId } = TrackParamsSchema.parse(request.params);
    const { expectedRevision } = ExpectedRevisionSchema.parse(request.query);
    const ownerId = ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    return service.removeTrack(ownerId, playlistId, trackId, expectedRevision);
  });

  app.patch('/playlists/:playlistId/tracks/:trackId/move', async (request, reply) => {
    const { playlistId, trackId } = TrackParamsSchema.parse(request.params);
    const input = MoveTrackRequestSchema.parse(request.body);
    const ownerId = ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    return service.moveTrack(ownerId, playlistId, trackId, input.toIndex, input.expectedRevision);
  });
};
