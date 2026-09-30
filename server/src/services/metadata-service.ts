import type { ResolvedTrackSource } from '@reproductor/shared';
import { parseSourceUrl, type ParsedSource } from '@reproductor/shared';
import { HttpError } from '../errors.js';

interface OembedResponse {
  title?: unknown;
  author_name?: unknown;
  thumbnail_url?: unknown;
}

export class MetadataService {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 5_000,
  ) {}

  async resolve(url: string, allowExtensionless = false): Promise<ResolvedTrackSource> {
    const source = parseSourceUrl(url, allowExtensionless);
    if (source.provider === 'youtube') return this.resolveYouTube(source);
    return this.resolveAudio(source);
  }

  private async resolveYouTube(source: ParsedSource): Promise<ResolvedTrackSource> {
    const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(source.sourceId)}`;
    const endpoint = new URL('https://www.youtube.com/oembed');
    endpoint.searchParams.set('url', videoUrl);
    endpoint.searchParams.set('format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint, { signal: controller.signal });
      if (response.status === 404 || response.status === 401) {
        throw new HttpError(
          422,
          'source_unavailable',
          'El video no existe o no permite la vista previa.',
        );
      }
      if (!response.ok) {
        throw new HttpError(
          502,
          'upstream_unavailable',
          'YouTube no respondió correctamente. Inténtalo de nuevo.',
        );
      }

      const metadata = (await response.json()) as OembedResponse;
      if (typeof metadata.title !== 'string' || metadata.title.trim().length === 0) {
        throw new HttpError(502, 'upstream_unavailable', 'YouTube devolvió metadatos incompletos.');
      }
      const thumbnailUrl = safeThumbnail(metadata.thumbnail_url);
      return {
        provider: 'youtube',
        sourceId: source.sourceId,
        sourceUrl: videoUrl,
        title: metadata.title.slice(0, 200),
        ...(typeof metadata.author_name === 'string'
          ? { artist: metadata.author_name.slice(0, 200) }
          : {}),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (controller.signal.aborted) {
        throw new HttpError(
          502,
          'upstream_unavailable',
          'La vista previa tardó demasiado. Inténtalo de nuevo.',
        );
      }
      throw new HttpError(
        502,
        'upstream_unavailable',
        'No fue posible consultar YouTube. Inténtalo de nuevo.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveAudio(source: ParsedSource): ResolvedTrackSource {
    const url = new URL(source.sourceUrl);
    const encodedFilename = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
    let filename = encodedFilename;
    try {
      filename = decodeURIComponent(encodedFilename);
    } catch {
      // Keep the encoded filename when a source contains invalid escape sequences.
    }
    const title = filename.replace(/\.(?:mp3|ogg|oga|wav|m4a|aac|flac|opus)$/i, '').trim();
    return {
      provider: 'audio',
      sourceId: source.sourceId,
      sourceUrl: source.sourceUrl,
      title: title ? title.slice(0, 200) : url.hostname,
    };
  }
}

function safeThumbnail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'i.ytimg.com' ? url.toString() : null;
  } catch {
    return null;
  }
}
