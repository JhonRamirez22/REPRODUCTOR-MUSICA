import { describe, expect, it, vi } from 'vitest';
import { JamendoService } from './jamendo-service.js';

function track(id = '1848357') {
  return {
    id,
    name: 'Mañana será tarde',
    artist_name: 'Fankel',
    duration: 272,
    image: 'https://usercontent.jamendo.com/cover.jpg',
    license_ccurl: 'http://creativecommons.org/licenses/by-nc-nd/3.0/',
  };
}

function response(results: unknown[]) {
  return new Response(
    JSON.stringify({ headers: { status: 'success', code: 0, error_message: '' }, results }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('JamendoService', () => {
  it('searches the fixed Jamendo API and returns attributed catalog results', async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      void input;
      return response([track()]);
    });
    const service = new JamendoService('private-client-id', fetchImpl);

    const results = await service.search('mañana y tarde');
    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));

    expect(requestUrl.origin).toBe('https://api.jamendo.com');
    expect(requestUrl.searchParams.get('client_id')).toBe('private-client-id');
    expect(requestUrl.searchParams.get('search')).toBe('mañana y tarde');
    expect(requestUrl.searchParams.get('limit')).toBe('20');
    expect(results).toEqual([
      {
        id: '1848357',
        title: 'Mañana será tarde',
        artist: 'Fankel',
        durationSec: 272,
        thumbnailUrl: 'https://usercontent.jamendo.com/cover.jpg',
        attributionUrl: 'https://www.jamendo.com/track/1848357',
        licenseUrl: 'https://creativecommons.org/licenses/by-nc-nd/3.0/',
      },
    ]);
    expect(JSON.stringify(results)).not.toContain('private-client-id');
  });

  it('resolves selected catalog IDs without exposing the stream or API credential', async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      void input;
      return response([track()]);
    });
    const service = new JamendoService('private-client-id', fetchImpl);

    const resolved = await service.resolveTrack('1848357');
    expect(resolved).toEqual({
      provider: 'jamendo',
      sourceId: '1848357',
      sourceUrl: 'https://www.jamendo.com/track/1848357',
      title: 'Mañana será tarde',
      artist: 'Fankel',
      durationSec: 272,
      thumbnailUrl: 'https://usercontent.jamendo.com/cover.jpg',
      attributionUrl: 'https://www.jamendo.com/track/1848357',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc-nd/3.0/',
    });
    expect(JSON.stringify(resolved)).not.toContain('private-client-id');
  });

  it('uses the credential only server-side to obtain a safe stream redirect', async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      void input;
      return new Response(null, {
        status: 302,
        headers: { location: 'https://prod-1.storage.jamendo.com/?trackid=1848357' },
      });
    });
    const service = new JamendoService('private-client-id', fetchImpl);

    await expect(service.getStreamRedirect('1848357')).resolves.toBe(
      'https://prod-1.storage.jamendo.com/?trackid=1848357',
    );
    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe('/v3.0/tracks/file/');
    expect(requestUrl.searchParams.get('client_id')).toBe('private-client-id');
    expect(requestUrl.searchParams.get('action')).toBe('stream');
  });

  it('rejects stream redirects outside Jamendo storage', async () => {
    const fetchImpl = async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://attacker.example/audio.mp3' },
      });
    const service = new JamendoService('private-client-id', fetchImpl);

    await expect(service.getStreamRedirect('1848357')).rejects.toMatchObject({
      statusCode: 502,
      code: 'catalog_unavailable',
    });
  });

  it('never forwards a redirect that contains the private API credential', async () => {
    const fetchImpl = async () =>
      new Response(null, {
        status: 302,
        headers: {
          location: 'https://prod-1.storage.jamendo.com/?client_id=private-client-id',
        },
      });
    const service = new JamendoService('private-client-id', fetchImpl);

    await expect(service.getStreamRedirect('1848357')).rejects.toMatchObject({
      statusCode: 502,
      code: 'catalog_unavailable',
    });
  });

  it('rejects malformed licenses and reports an unconfigured catalog', async () => {
    const service = new JamendoService('private-client-id', async () =>
      response([
        {
          ...track(),
          license_ccurl: 'https://evil.example/license',
        },
      ]),
    );
    await expect(service.search('track')).rejects.toMatchObject({ code: 'catalog_unavailable' });
    await expect(new JamendoService(undefined).search('track')).rejects.toMatchObject({
      statusCode: 503,
      code: 'catalog_not_configured',
    });
  });
});
