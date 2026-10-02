import type { RepeatMode } from '@reproductor/shared';

const PREFERENCES_KEY = 'reproductor:player-preferences';
const LAST_TRACK_KEY = 'reproductor:last-track';

export interface PlaybackPreferences {
  volume: number;
  repeatMode: RepeatMode;
  isShuffled: boolean;
}

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  volume: 0.8,
  repeatMode: 'off',
  isShuffled: false,
};

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readPlaybackPreferences(): PlaybackPreferences {
  const storage = getStorage();
  if (!storage) return DEFAULT_PLAYBACK_PREFERENCES;

  try {
    const raw: unknown = JSON.parse(storage.getItem(PREFERENCES_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return DEFAULT_PLAYBACK_PREFERENCES;
    const value = raw as Record<string, unknown>;
    const volume =
      typeof value.volume === 'number' && Number.isFinite(value.volume)
        ? Math.max(0, Math.min(1, value.volume))
        : DEFAULT_PLAYBACK_PREFERENCES.volume;
    const repeatMode: RepeatMode =
      value.repeatMode === 'all' || value.repeatMode === 'one' ? value.repeatMode : 'off';
    const isShuffled = value.isShuffled === true;
    return { volume, repeatMode, isShuffled };
  } catch {
    return DEFAULT_PLAYBACK_PREFERENCES;
  }
}

export function writePlaybackPreferences(preferences: PlaybackPreferences): void {
  try {
    getStorage()?.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    return;
  }
}

export function readLastTrackId(): string | null {
  try {
    return getStorage()?.getItem(LAST_TRACK_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeLastTrackId(trackId: string | null): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    if (trackId) storage.setItem(LAST_TRACK_KEY, trackId);
    else storage.removeItem(LAST_TRACK_KEY);
  } catch {
    return;
  }
}
