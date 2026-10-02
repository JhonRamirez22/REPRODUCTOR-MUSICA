import type { PlaybackTrack } from './local-track.js';

export type PlayerEventName = 'ready' | 'ended' | 'error' | 'timeupdate' | 'statechange';
export type PlayerEventHandler = (payload: unknown) => void;

export interface PlayerEngine {
  load(track: PlaybackTrack): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume01: number): void;
  destroy(): void;
  on(event: PlayerEventName, callback: PlayerEventHandler): () => void;
}

export type PlayerEngineFactory = (
  provider: PlaybackTrack['provider'],
  container: HTMLElement | null,
) => PlayerEngine;

export class EventEmitter {
  private readonly handlers = new Map<PlayerEventName, Set<PlayerEventHandler>>();

  on(event: PlayerEventName, callback: PlayerEventHandler): () => void {
    const callbacks = this.handlers.get(event) ?? new Set<PlayerEventHandler>();
    callbacks.add(callback);
    this.handlers.set(event, callbacks);
    return () => callbacks.delete(callback);
  }

  emit(event: PlayerEventName, payload: unknown = undefined): void {
    for (const callback of this.handlers.get(event) ?? []) callback(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export function isPlaybackTime(value: unknown): value is { currentTime: number; duration: number } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.currentTime === 'number' && typeof record.duration === 'number';
}
