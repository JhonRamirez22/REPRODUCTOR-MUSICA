import {
  AddTrackRequestSchema,
  CreatePlaylistRequestSchema,
  MoveTrackRequestSchema,
  RenamePlaylistRequestSchema,
} from '@reproductor/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { HttpError } from '../errors.js';
import type { YtMusicService } from '../services/ytmusic-service.js';
import type { PlaylistService } from '../services/playlist-service.js';
import type { AuthService } from '../services/auth-service.js';

const PlaylistParamsSchema = z.object({ playlistId: z.string().uuid() });
const TrackParamsSchema = PlaylistParamsSchema.extend({ trackId: z.string().uuid() });
const ExpectedRevisionSchema = z.object({
  expectedRevision: z.coerce.number().int().nonnegative(),
});

interface PlaylistRouteOptions {
  service: PlaylistService;
  catalog: YtMusicService;
  config: AppConfig;
  auth: AuthService;
}

export const playlistRoutes: FastifyPluginAsync<PlaylistRouteOptions> = async (
  app,
  { service, catalog, config, auth },
) => {
  app.get('/playlists', async (request, reply) => {
    const ownerId = await auth.ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    return service.list(ownerId);
  });

  app.post('/playlists', async (request, reply) => {
    const input = CreatePlaylistRequestSchema.parse(request.body);
    const ownerId = await auth.ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    const playlist = await service.create(ownerId, input.name);
    return reply.code(201).send(playlist);
  });

  app.get('/playlists/:playlistId', async (request, reply) => {
    const { playlistId } = PlaylistParamsSchema.parse(request.params);
    const ownerId = await auth.ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    const playlist = await service.get(ownerId, playlistId);
    if (!playlist) throw new HttpError(404, 'not_found', 'No se encontró la playlist.');
    return playlist;
  });

  app.patch('/playlists/:playlistId', async (request, reply) => {
    const { playlistId } = PlaylistParamsSchema.parse(request.params);
    const input = RenamePlaylistRequestSchema.parse(request.body);
    const ownerId = await auth.ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    return service.rename(ownerId, playlistId, input.name);
  });

  app.delete('/playlists/:playlistId', async (request, reply) => {
    const { playlistId } = PlaylistParamsSchema.parse(request.params);
    const ownerId = await auth.ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    const deleted = await service.delete(ownerId, playlistId);
    if (!deleted) throw new HttpError(404, 'not_found', 'No se encontró la playlist.');
    return reply.code(204).send();
  });

  app.post('/playlists/:playlistId/tracks', async (request, reply) => {
    const { playlistId } = PlaylistParamsSchema.parse(request.params);
    const input = AddTrackRequestSchema.parse(request.body);
    const ownerId = await auth.ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    const source = await catalog.resolveTrack(input.query, input.videoId);
    const playlist = await service.addTrack(ownerId, playlistId, input, source);
    return reply.code(201).send(playlist);
  });

  app.delete('/playlists/:playlistId/tracks/:trackId', async (request, reply) => {
    const { playlistId, trackId } = TrackParamsSchema.parse(request.params);
    const { expectedRevision } = ExpectedRevisionSchema.parse(request.query);
    const ownerId = await auth.ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    return service.removeTrack(ownerId, playlistId, trackId, expectedRevision);
  });

  app.patch('/playlists/:playlistId/tracks/:trackId/move', async (request, reply) => {
    const { playlistId, trackId } = TrackParamsSchema.parse(request.params);
    const input = MoveTrackRequestSchema.parse(request.body);
    const ownerId = await auth.ownerIdForRequest(request, reply, config.NODE_ENV === 'production');
    return service.moveTrack(ownerId, playlistId, trackId, input.toIndex, input.expectedRevision);
  });
};
