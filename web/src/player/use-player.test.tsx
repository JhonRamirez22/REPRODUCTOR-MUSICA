// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Track } from '@reproductor/shared';
import { EventEmitter, type PlayerEngine, type PlayerEngineFactory } from './engine.js';
import { usePlayer } from './use-player.js';

function makeTrack(id: string, title: string): Track {
  return {
    id,
    playlistId: '00000000-0000-4000-8000-000000000001',
    position: 0,
    provider: 'audio',
    sourceId: `https://cdn.example.org/${title}.mp3`,
    sourceUrl: `https://cdn.example.org/${title}.mp3`,
    title,
    artist: null,
    durationSec: 120,
    thumbnailUrl: null,
    attributionUrl: null,
    licenseUrl: null,
    available: true,
  };
}

class FakePlayerEngine implements PlayerEngine {
  readonly events = new EventEmitter();
  loadedTrack: Track | null = null;
  playCount = 0;
  seekTo = -1;
  volume = 1;

  async load(track: Track): Promise<void> {
    this.loadedTrack = track;
    this.events.emit('ready');
  }

  async play(): Promise<void> {
    this.playCount += 1;
    this.events.emit('statechange', 'playing');
  }

  pause(): void {
    this.events.emit('statechange', 'paused');
  }

  seek(seconds: number): void {
    this.seekTo = seconds;
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  destroy(): void {
    this.events.clear();
  }

  on = this.events.on.bind(this.events);
}

describe('usePlayer', () => {
  it('loads and advances tracks through the linked playback cursor', async () => {
    const first = makeTrack('00000000-0000-4000-8000-000000000002', 'Primera');
    const second = makeTrack('00000000-0000-4000-8000-000000000003', 'Segunda');
    const tracks = [first, second];
    const engine = new FakePlayerEngine();
    const factory: PlayerEngineFactory = () => engine;
    const { result } = renderHook(() => usePlayer(tracks, undefined, factory));

    await waitFor(() => expect(result.current.currentTrack?.id).toBe(first.id));
    act(() => result.current.togglePlay());
    await waitFor(() => expect(engine.playCount).toBe(1));
    expect(result.current.isPlaying).toBe(true);

    act(() => engine.events.emit('ended'));
    await waitFor(() => expect(engine.playCount).toBe(2));
    expect(engine.loadedTrack?.id).toBe(second.id);
    expect(result.current.currentTrack?.id).toBe(second.id);
  });

  it('marks an unavailable source and stops when the queue has no alternative', async () => {
    const onlyTrack = makeTrack('00000000-0000-4000-8000-000000000004', 'No disponible');
    const tracks = [onlyTrack];
    const engine = new FakePlayerEngine();
    const factory: PlayerEngineFactory = () => engine;
    const { result } = renderHook(() => usePlayer(tracks, undefined, factory));

    act(() => result.current.togglePlay());
    await waitFor(() => expect(engine.playCount).toBe(1));
    act(() => engine.events.emit('error'));

    await waitFor(() => expect(result.current.unavailableIds.has(onlyTrack.id)).toBe(true));
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.message).toBe('No hay pistas disponibles en esta playlist.');
  });

  it('replays the same track at natural end when repeat-one is active', async () => {
    const onlyTrack = makeTrack('00000000-0000-4000-8000-000000000005', 'Repetir');
    const tracks = [onlyTrack];
    const engine = new FakePlayerEngine();
    const factory: PlayerEngineFactory = () => engine;
    const { result } = renderHook(() => usePlayer(tracks, undefined, factory));

    act(() => result.current.toggleRepeat());
    act(() => result.current.toggleRepeat());
    act(() => result.current.togglePlay());
    expect(result.current.repeatMode).toBe('one');
    await waitFor(() => expect(engine.playCount).toBe(1));
    act(() => engine.events.emit('ended'));

    await waitFor(() => expect(engine.playCount).toBe(2));
    expect(engine.seekTo).toBe(0);
    expect(result.current.currentTrack?.id).toBe(onlyTrack.id);
  });

  it('allows retrying a failed queue item by selecting it again', async () => {
    const first = makeTrack('00000000-0000-4000-8000-000000000006', 'Primera');
    const second = makeTrack('00000000-0000-4000-8000-000000000007', 'Segunda');
    const tracks = [first, second];
    const engine = new FakePlayerEngine();
    const factory: PlayerEngineFactory = () => engine;
    const { result } = renderHook(() => usePlayer(tracks, undefined, factory));

    act(() => result.current.togglePlay());
    await waitFor(() => expect(engine.playCount).toBe(1));
    act(() => engine.events.emit('error'));
    await waitFor(() => expect(result.current.currentTrack?.id).toBe(second.id));
    expect(result.current.unavailableIds.has(first.id)).toBe(true);

    act(() => result.current.playTrack(first.id));
    await waitFor(() => expect(engine.playCount).toBe(2));
    expect(result.current.currentTrack?.id).toBe(first.id);
    expect(result.current.unavailableIds.has(first.id)).toBe(false);
  });
});
