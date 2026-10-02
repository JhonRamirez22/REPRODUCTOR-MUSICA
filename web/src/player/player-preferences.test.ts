// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PLAYBACK_PREFERENCES,
  readLastTrackId,
  readPlaybackPreferences,
  writeLastTrackId,
  writePlaybackPreferences,
} from './player-preferences.js';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

let storage: Storage;

beforeEach(() => {
  storage = createStorage();
  vi.stubGlobal('window', { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

describe('playback preferences', () => {
  it('persists volume, repeat mode, shuffle and the last track safely', () => {
    writePlaybackPreferences({ volume: 0.35, repeatMode: 'one', isShuffled: true });
    writeLastTrackId('track-1');

    expect(readPlaybackPreferences()).toEqual({
      volume: 0.35,
      repeatMode: 'one',
      isShuffled: true,
    });
    expect(readLastTrackId()).toBe('track-1');
  });

  it('clamps malformed preference values and tolerates unavailable storage', () => {
    storage.setItem(
      'reproductor:player-preferences',
      JSON.stringify({ volume: 4, repeatMode: 'unsupported', isShuffled: 'yes' }),
    );
    expect(readPlaybackPreferences()).toEqual({ volume: 1, repeatMode: 'off', isShuffled: false });

    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(readPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
    expect(readLastTrackId()).toBeNull();
  });
});
