import type { CatalogTrack, ResolvedCatalogTrack } from '@reproductor/shared';
import { z } from 'zod';
import { HttpError } from '../errors.js';

const JamendoTrackSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().regex(/^\d{1,20}$/)),
  name: z.string().trim().min(1),
  artist_name: z.string().trim().min(1),
  duration: z.number().int().nonnegative(),
  image: z.string().nullable().optional(),
  license_ccurl: z.string().url(),
});

const JamendoResponseSchema = z.object({
  headers: z.object({ status: z.string(), code: z.number().int(), error_message: z.string() }),
  results: z.array(JamendoTrackSchema),
});

export class JamendoService {
  constructor(
    private readonly clientId: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 5_000,
  ) {}

  async search(query: string): Promise<CatalogTrack[]> {
    const endpoint = this.endpoint('tracks');
    endpoint.searchParams.set('search', query);
    endpoint.searchParams.set('limit', '20');
    endpoint.searchParams.set('audioformat', 'mp32');
    endpoint.searchParams.set('include', 'licenses');
    endpoint.searchParams.set('type', 'single albumtrack');
    const tracks = await this.readTracks(endpoint);
    return tracks.map((track) => this.toCatalogTrack(track));
  }

  async resolveTrack(trackId: string): Promise<ResolvedCatalogTrack> {
    const endpoint = this.endpoint('tracks');
    endpoint.searchParams.set('id', trackId);
    endpoint.searchParams.set('limit', '1');
    endpoint.searchParams.set('audioformat', 'mp32');
    endpoint.searchParams.set('include', 'licenses');
    endpoint.searchParams.set('type', 'single albumtrack');
    const track = (await this.readTracks(endpoint))[0];
    if (!track) {
      throw new HttpError(404, 'catalog_track_not_found', 'No se encontró esa pista en Jamendo.');
    }
    const catalogTrack = this.toCatalogTrack(track);
    return {
      provider: 'jamendo',
      sourceId: catalogTrack.id,
      sourceUrl: catalogTrack.attributionUrl,
      title: catalogTrack.title,
      artist: catalogTrack.artist,
      durationSec: catalogTrack.durationSec,
      ...(catalogTrack.thumbnailUrl ? { thumbnailUrl: catalogTrack.thumbnailUrl } : {}),
      attributionUrl: catalogTrack.attributionUrl,
      licenseUrl: catalogTrack.licenseUrl,
    };
  }

  async getStreamRedirect(trackId: string): Promise<string> {
    const endpoint = this.endpoint('tracks/file');
    endpoint.searchParams.set('id', trackId);
    endpoint.searchParams.set('action', 'stream');
    endpoint.searchParams.set('audioformat', 'mp32');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint, {
        signal: controller.signal,
        redirect: 'manual',
      });
      const location = response.headers.get('location');
      if (!response.ok && response.status < 300) {
        throw this.upstreamError();
      }
      if (response.status < 300 || response.status >= 400 || !location) {
        if (response.status === 404) {
          throw new HttpError(404, 'catalog_track_not_found', 'Esta pista ya no está disponible.');
        }
        throw this.upstreamError();
      }
      const streamUrl = new URL(location, endpoint);
      if (
        streamUrl.protocol !== 'https:' ||
        !streamUrl.hostname.endsWith('.storage.jamendo.com') ||
        streamUrl.searchParams.has('client_id')
      ) {
        throw this.upstreamError();
      }
      return streamUrl.toString();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        502,
        'catalog_unavailable',
        controller.signal.aborted
          ? 'La conexión con Jamendo tardó demasiado.'
          : 'No fue posible abrir esta pista de Jamendo.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readTracks(endpoint: URL): Promise<z.output<typeof JamendoTrackSchema>[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint, {
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) throw this.upstreamError();
      const payload: unknown = await response.json();
      const parsed = JamendoResponseSchema.safeParse(payload);
      if (!parsed.success || parsed.data.headers.status !== 'success' || parsed.data.headers.code) {
        throw this.upstreamError();
      }
      return parsed.data.results;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        502,
        'catalog_unavailable',
        controller.signal.aborted
          ? 'La búsqueda en Jamendo tardó demasiado.'
          : 'No fue posible consultar el catálogo de Jamendo.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private toCatalogTrack(track: z.output<typeof JamendoTrackSchema>): CatalogTrack {
    const licenseUrl = safeLicenseUrl(track.license_ccurl);
    if (!licenseUrl) throw this.upstreamError();
    return {
      id: track.id,
      title: track.name.slice(0, 200),
      artist: track.artist_name.slice(0, 200),
      durationSec: track.duration,
      thumbnailUrl: safeArtworkUrl(track.image),
      attributionUrl: `https://www.jamendo.com/track/${track.id}`,
      licenseUrl,
    };
  }

  private endpoint(method: string): URL {
    if (!this.clientId) {
      throw new HttpError(
        503,
        'catalog_not_configured',
        'El catálogo necesita una credencial JAMENDO_CLIENT_ID en el servidor.',
      );
    }
    const endpoint = new URL(`https://api.jamendo.com/v3.0/${method}/`);
    endpoint.searchParams.set('client_id', this.clientId);
    endpoint.searchParams.set('format', 'json');
    return endpoint;
  }

  private upstreamError(): HttpError {
    return new HttpError(
      502,
      'catalog_unavailable',
      'Jamendo no respondió correctamente. Inténtalo de nuevo.',
    );
  }
}

function safeArtworkUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'usercontent.jamendo.com'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function safeLicenseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname !== 'creativecommons.org' || !url.pathname.startsWith('/licenses/'))
      return null;
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}
