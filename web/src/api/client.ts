import {
  ErrorResponseSchema,
  PlaylistSchema,
  PlaylistSummarySchema,
  ResolveRequestSchema,
  ResolveResponseSchema,
  type AddTrackRequest,
  type Playlist,
  type PlaylistSummary,
  type ResolvedTrackSource,
} from '@reproductor/shared';
import { z } from 'zod';

const PlaylistListSchema = z.array(PlaylistSummarySchema);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<Schema extends z.ZodTypeAny>(
  path: string,
  schema: Schema,
  init?: RequestInit,
): Promise<z.output<Schema>> {
  let response: Response;
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && init.body !== null && !headers.has('content-type'))
    headers.set('content-type', 'application/json');
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      0,
      'network_error',
    );
  }

  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(await response.json().catch(() => null));
    throw new ApiError(
      parsed.success ? parsed.data.error.message : 'No fue posible completar la solicitud.',
      response.status,
      parsed.success ? parsed.data.error.code : 'request_failed',
    );
  }
  if (response.status === 204) return schema.parse(undefined);
  const payload: unknown = await response.json();
  return schema.parse(payload);
}

export const api = {
  listPlaylists(): Promise<PlaylistSummary[]> {
    return request('/api/playlists', PlaylistListSchema);
  },
  getPlaylist(id: string): Promise<Playlist> {
    return request(`/api/playlists/${encodeURIComponent(id)}`, PlaylistSchema);
  },
  createPlaylist(name: string): Promise<Playlist> {
    return request('/api/playlists', PlaylistSchema, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  renamePlaylist(id: string, name: string): Promise<Playlist> {
    return request(`/api/playlists/${encodeURIComponent(id)}`, PlaylistSchema, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },
  async deletePlaylist(id: string): Promise<void> {
    await request(`/api/playlists/${encodeURIComponent(id)}`, z.void(), { method: 'DELETE' });
  },
  resolve(url: string, allowExtensionless: boolean): Promise<ResolvedTrackSource> {
    const body = ResolveRequestSchema.parse({ url, allowExtensionless });
    return request('/api/resolve', ResolveResponseSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  addTrack(
    playlistId: string,
    input: Omit<AddTrackRequest, 'expectedRevision'> & { expectedRevision: number },
  ): Promise<Playlist> {
    return request(`/api/playlists/${encodeURIComponent(playlistId)}/tracks`, PlaylistSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  removeTrack(playlistId: string, trackId: string, expectedRevision: number): Promise<Playlist> {
    const query = new URLSearchParams({ expectedRevision: String(expectedRevision) });
    return request(
      `/api/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}?${query}`,
      PlaylistSchema,
      { method: 'DELETE' },
    );
  },
  moveTrack(
    playlistId: string,
    trackId: string,
    toIndex: number,
    expectedRevision: number,
  ): Promise<Playlist> {
    return request(
      `/api/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}/move`,
      PlaylistSchema,
      { method: 'PATCH', body: JSON.stringify({ toIndex, expectedRevision }) },
    );
  },
};
