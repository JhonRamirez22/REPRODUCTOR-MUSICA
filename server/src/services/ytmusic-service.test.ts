import { describe, expect, it, vi } from 'vitest';
import { YtMusicService, type YtMusicRequest } from './ytmusic-service.js';

const result = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Mañana será tarde',
  artist: 'Fankel',
  durationSec: 272,
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
};

describe('YtMusicService', () => {
  it('checks availability and maps public search results to safe YouTube metadata', async () => {
    const run = vi.fn(async ({ action }: YtMusicRequest) =>
      action === 'check' ? { ready: true } : [result],
    );
    const service = new YtMusicService('python3', run);

    await expect(service.isAvailable()).resolves.toBe(true);
    await expect(service.search('Fankel')).resolves.toEqual([
      {
        id: 'dQw4w9WgXcQ',
        title: 'Mañana será tarde',
        artist: 'Fankel',
        durationSec: 272,
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        attributionUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ]);
    await expect(service.resolveTrack(' fankel ', 'dQw4w9WgXcQ')).resolves.toMatchObject({
      sourceId: 'dQw4w9WgXcQ',
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('rejects untrusted thumbnails and re-verifies a selected result against the query', async () => {
    const run = vi.fn(async ({ action }: YtMusicRequest) =>
      action === 'check'
        ? { ready: true }
        : [{ ...result, thumbnailUrl: 'https://attacker.example/image.jpg' }],
    );
    const service = new YtMusicService('python3', run);

    const resolved = await service.resolveTrack('Fankel', 'dQw4w9WgXcQ');
    expect(resolved).toMatchObject({
      provider: 'youtube',
      sourceId: 'dQw4w9WgXcQ',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    expect('thumbnailUrl' in resolved).toBe(false);
    await expect(service.resolveTrack('Different search', 'aaaaaaaaaaa')).rejects.toMatchObject({
      statusCode: 404,
      code: 'catalog_track_not_found',
    });
  });

  it('accepts YouTube Music channel thumbnails served by googleusercontent', async () => {
    const thumbnailUrl = 'https://yt3.googleusercontent.com/channel-avatar=s240';
    const service = new YtMusicService('python3', async ({ action }) =>
      action === 'check' ? { ready: true } : [{ ...result, thumbnailUrl }],
    );

    await expect(service.search('Fankel')).resolves.toMatchObject([{ thumbnailUrl }]);
  });

  it('reports an unavailable Python dependency without exposing a credential', async () => {
    const service = new YtMusicService('python3', async () => {
      throw new Error('ModuleNotFoundError');
    });

    await expect(service.isAvailable()).resolves.toBe(false);
  });
});
