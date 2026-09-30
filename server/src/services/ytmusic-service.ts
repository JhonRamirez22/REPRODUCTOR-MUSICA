import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { CatalogTrack, ResolvedCatalogTrack } from '@reproductor/shared';
import { z } from 'zod';
import { HttpError } from '../errors.js';

const SearchResultSchema = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200),
  durationSec: z.number().int().nonnegative().nullable(),
  thumbnailUrl: z.string().url().nullable(),
});
const SEARCH_CACHE_TTL_MS = 5 * 60_000;
const SEARCH_CACHE_LIMIT = 100;

export interface YtMusicRequest {
  action: 'check' | 'search';
  query?: string;
}

export type YtMusicRunner = (request: YtMusicRequest) => Promise<unknown>;

export class YtMusicService {
  private readonly run: YtMusicRunner;
  private availability: Promise<boolean> | null = null;
  private readonly searchCache = new Map<string, { expiresAt: number; tracks: CatalogTrack[] }>();
  private readonly pendingSearches = new Map<string, Promise<CatalogTrack[]>>();

  constructor(pythonExecutable = 'python3', run?: YtMusicRunner) {
    this.run = run ?? ((request) => runPython(pythonExecutable, request));
  }

  async isAvailable(): Promise<boolean> {
    this.availability ??= this.run({ action: 'check' })
      .then((response) => z.object({ ready: z.literal(true) }).safeParse(response).success)
      .catch(() => false);
    return this.availability;
  }

  async search(query: string): Promise<CatalogTrack[]> {
    const key = normalizeQuery(query);
    const cached = this.searchCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.tracks;
    if (cached) this.searchCache.delete(key);

    const pending = this.pendingSearches.get(key);
    if (pending) return pending;

    const request = this.searchUpstream(query);
    this.pendingSearches.set(key, request);
    try {
      const tracks = await request;
      this.pruneSearchCache();
      this.searchCache.set(key, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, tracks });
      while (this.searchCache.size > SEARCH_CACHE_LIMIT) {
        const oldestKey = this.searchCache.keys().next().value;
        if (oldestKey === undefined) break;
        this.searchCache.delete(oldestKey);
      }
      return tracks;
    } finally {
      if (this.pendingSearches.get(key) === request) this.pendingSearches.delete(key);
    }
  }

  async resolveTrack(query: string, videoId: string): Promise<ResolvedCatalogTrack> {
    const track = (await this.search(query)).find((result) => result.id === videoId);
    if (!track) {
      throw new HttpError(
        404,
        'catalog_track_not_found',
        'No se encontró esa canción en YouTube Music.',
      );
    }
    return {
      provider: 'youtube',
      sourceId: track.id,
      sourceUrl: track.attributionUrl,
      title: track.title,
      artist: track.artist,
      durationSec: track.durationSec ?? undefined,
      ...(track.thumbnailUrl ? { thumbnailUrl: track.thumbnailUrl } : {}),
      attributionUrl: track.attributionUrl,
    };
  }

  private upstreamError(): HttpError {
    return new HttpError(
      502,
      'catalog_unavailable',
      'No fue posible consultar YouTube Music. Inténtalo de nuevo en un momento.',
    );
  }

  private async searchUpstream(query: string): Promise<CatalogTrack[]> {
    try {
      const response = await this.run({ action: 'search', query });
      if (!Array.isArray(response)) throw this.upstreamError();
      return response.flatMap((entry) => {
        const parsed = SearchResultSchema.safeParse(entry);
        if (!parsed.success) return [];
        const track = parsed.data;
        return [
          {
            id: track.videoId,
            title: track.title,
            artist: track.artist,
            durationSec: track.durationSec,
            thumbnailUrl: safeThumbnailUrl(track.thumbnailUrl),
            attributionUrl: `https://www.youtube.com/watch?v=${track.videoId}`,
          },
        ];
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw this.upstreamError();
    }
  }

  private pruneSearchCache(): void {
    const now = Date.now();
    for (const [key, value] of this.searchCache) {
      if (value.expiresAt <= now) this.searchCache.delete(key);
    }
  }
}

const SEARCH_SCRIPT = fileURLToPath(new URL('../../python/search.py', import.meta.url));
const MAX_OUTPUT_BYTES = 256 * 1024;
const TIMEOUT_MS = 10_000;

function runPython(pythonExecutable: string, request: YtMusicRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable, [SEARCH_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;
    const finish = (error?: Error, value?: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(value);
    };
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      finish(new Error('ytmusicapi timed out'));
    }, TIMEOUT_MS);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill('SIGTERM');
        finish(new Error('ytmusicapi output exceeded the limit'));
        return;
      }
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < 2_000) stderr += chunk;
    });
    child.once('error', (error) => finish(error));
    child.once('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error(stderr.trim() || `ytmusicapi exited with code ${code ?? 'unknown'}`));
        return;
      }
      try {
        finish(undefined, JSON.parse(stdout) as unknown);
      } catch {
        finish(new Error('ytmusicapi returned invalid JSON'));
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

function safeThumbnailUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol === 'https:' &&
      [
        'lh3.googleusercontent.com',
        'yt3.ggpht.com',
        'yt3.googleusercontent.com',
        'i.ytimg.com',
      ].includes(url.hostname)
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeQuery(query: string): string {
  return query.trim().normalize('NFC').toLocaleLowerCase();
}
