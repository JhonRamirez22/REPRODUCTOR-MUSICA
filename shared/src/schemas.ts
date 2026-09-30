import { z } from 'zod';

export const ProviderSchema = z.enum(['youtube', 'audio', 'jamendo']);

export const CatalogTrackSchema = z.object({
  id: z.string().regex(/^\d{1,20}$/),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200),
  durationSec: z.number().int().nonnegative(),
  thumbnailUrl: z.string().url().nullable(),
  attributionUrl: z.string().url(),
  licenseUrl: z.string().url(),
});

export const CatalogStatusSchema = z.object({ enabled: z.boolean() });
export const CatalogSearchResponseSchema = z.object({ tracks: z.array(CatalogTrackSchema) });

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
  attributionUrl: z.string().url().nullable(),
  licenseUrl: z.string().url().nullable(),
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

export const ResolvedCatalogTrackSchema = z.object({
  provider: z.literal('jamendo'),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).optional(),
  thumbnailUrl: z.string().url().optional(),
  durationSec: z.number().int().nonnegative().optional(),
  attributionUrl: z.string().url().optional(),
  licenseUrl: z.string().url().optional(),
});

export const InsertAtSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('head') }),
  z.object({ mode: z.literal('tail') }),
  z.object({ mode: z.literal('index'), index: z.number().int().nonnegative() }),
]);

export const AddTrackRequestSchema = z.object({
  catalogTrackId: z.string().regex(/^\d{1,20}$/),
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
export type CatalogTrack = z.infer<typeof CatalogTrackSchema>;
export type CatalogSearchResponse = z.infer<typeof CatalogSearchResponseSchema>;
export type CatalogStatus = z.infer<typeof CatalogStatusSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Playlist = z.infer<typeof PlaylistSchema>;
export type PlaylistSummary = z.infer<typeof PlaylistSummarySchema>;
export type ResolvedCatalogTrack = z.infer<typeof ResolvedCatalogTrackSchema>;
export type AddTrackRequest = z.infer<typeof AddTrackRequestSchema>;
export type InsertAt = z.infer<typeof InsertAtSchema>;
