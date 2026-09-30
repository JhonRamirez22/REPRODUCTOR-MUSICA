import { describe, expect, it, vi } from 'vitest';
import { MetadataService } from './metadata-service.js';

const youtubeUrl = 'https://youtube.com/watch?v=a1B2c3D4e5F';

describe('MetadataService', () => {
  it('resolves YouTube metadata using only the fixed oEmbed host', async () => {
    const fetchImpl: typeof fetch = vi.fn(async (input) => {
      expect(new URL(String(input)).origin).toBe('https://www.youtube.com');
      expect(new URL(String(input)).pathname).toBe('/oembed');
      return new Response(
        JSON.stringify({
          title: 'Título externo',
          author_name: 'Artista externo',
          thumbnail_url: 'https://i.ytimg.com/vi/a1B2c3D4e5F/hqdefault.jpg',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const service = new MetadataService(fetchImpl);
    await expect(service.resolve(youtubeUrl)).resolves.toMatchObject({
      provider: 'youtube',
      sourceId: 'a1B2c3D4e5F',
      title: 'Título externo',
      artist: 'Artista externo',
      thumbnailUrl: 'https://i.ytimg.com/vi/a1B2c3D4e5F/hqdefault.jpg',
    });
  });

  it('maps unavailable YouTube videos to a clear client error', async () => {
    const service = new MetadataService(async () => new Response(null, { status: 404 }));
    await expect(service.resolve(youtubeUrl)).rejects.toMatchObject({
      statusCode: 422,
      code: 'source_unavailable',
    });
  });

  it('maps a five-second upstream timeout to 502', async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    const service = new MetadataService(fetchImpl, 5);
    await expect(service.resolve(youtubeUrl)).rejects.toMatchObject({
      statusCode: 502,
      code: 'upstream_unavailable',
    });
  });

  it('parses direct audio links without fetching the supplied URL', async () => {
    const fetchImpl: typeof fetch = vi.fn();
    const service = new MetadataService(fetchImpl);
    await expect(
      service.resolve('https://cdn.example.org/audio/recital.flac'),
    ).resolves.toMatchObject({
      provider: 'audio',
      title: 'recital',
      sourceUrl: 'https://cdn.example.org/audio/recital.flac',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps a malformed percent-encoded filename from becoming a server error', async () => {
    const service = new MetadataService();
    await expect(service.resolve('https://cdn.example.org/%E0%A4%A.mp3')).resolves.toMatchObject({
      provider: 'audio',
      title: '%E0%A4%A',
    });
  });
});
