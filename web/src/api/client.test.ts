import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './client.js';

describe('API client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not declare a JSON body for bodyless delete requests', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    await api.deletePlaylist('00000000-0000-4000-8000-000000000001');

    const requestInit = fetchSpy.mock.calls[0]?.[1];
    expect(new Headers(requestInit?.headers).has('content-type')).toBe(false);
  });
});
