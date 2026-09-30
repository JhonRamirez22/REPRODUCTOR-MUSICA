import { z } from 'zod';

export const ProviderSchema = z.enum(['youtube', 'audio']);

export const TrackSchema = z.object({
  id: z.string().uuid(),
  playlistId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  provider: ProviderSchema,
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).nullable(),
  durationSec: z.number().int().nonnegative().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  available: z.boolean().default(true),
});

export const PlaylistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  revision: z.number().int().nonnegative(),
  trackCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tracks: z.array(TrackSchema).optional(),
});

export const PlaylistSummarySchema = PlaylistSchema.omit({ tracks: true });

export const CreatePlaylistRequestSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre para la playlist.').max(80),
});

export const RenamePlaylistRequestSchema = CreatePlaylistRequestSchema;

export const ResolveRequestSchema = z.object({
  url: z.string().trim().min(1),
  allowExtensionless: z.boolean().default(false),
});

export const ResolveResponseSchema = z.object({
  provider: ProviderSchema,
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).optional(),
  thumbnailUrl: z.string().url().optional(),
  durationSec: z.number().int().nonnegative().optional(),
});

export const InsertAtSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('head') }),
  z.object({ mode: z.literal('tail') }),
  z.object({ mode: z.literal('index'), index: z.number().int().nonnegative() }),
]);

export const AddTrackRequestSchema = z.object({
  url: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  artist: z.string().trim().max(200).optional(),
  allowExtensionless: z.boolean().default(false),
  resolved: ResolveResponseSchema.optional(),
  at: InsertAtSchema,
  expectedRevision: z.number().int().nonnegative(),
});

export const MoveTrackRequestSchema = z.object({
  toIndex: z.number().int().nonnegative(),
  expectedRevision: z.number().int().nonnegative(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type Provider = z.infer<typeof ProviderSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Playlist = z.infer<typeof PlaylistSchema>;
export type PlaylistSummary = z.infer<typeof PlaylistSummarySchema>;
export type ResolveRequest = z.infer<typeof ResolveRequestSchema>;
export type ResolvedTrackSource = z.infer<typeof ResolveResponseSchema>;
export type AddTrackRequest = z.infer<typeof AddTrackRequestSchema>;
export type InsertAt = z.infer<typeof InsertAtSchema>;
