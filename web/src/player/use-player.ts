import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useMotionValue, type MotionValue } from 'framer-motion';
import { DoublyLinkedList, PlaybackCursor, type RepeatMode } from '@reproductor/shared';
import { AudioEngine } from './audio-engine.js';
import { isPlaybackTime, type PlayerEngine, type PlayerEngineFactory } from './engine.js';
import type { PlaybackTrack } from './local-track.js';
import {
  readLastTrackId,
  readPlaybackPreferences,
  writeLastTrackId,
  writePlaybackPreferences,
} from './player-preferences.js';
import { YouTubeEngine } from './youtube-engine.js';

const NO_TRACKS: PlaybackTrack[] = [];

function defaultEngineFactory(
  provider: PlaybackTrack['provider'],
  container: HTMLElement | null,
): PlayerEngine {
  if (provider === 'youtube') {
    if (!container) throw new Error('Falta el espacio visible para el reproductor de YouTube.');
    return new YouTubeEngine(container);
  }
  return new AudioEngine();
}

export interface PlayerState {
  currentTrack: PlaybackTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  isPrepared: boolean;
  currentTime: number;
  currentTimeMotion: MotionValue<number>;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  unavailableIds: ReadonlySet<string>;
  message: string | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  playTrack: (trackId: string) => void;
}

export function usePlayer(
  tracks: readonly PlaybackTrack[] = NO_TRACKS,
  containerRef?: RefObject<HTMLElement | null>,
  engineFactory: PlayerEngineFactory = defaultEngineFactory,
): PlayerState {
  const [savedPreferences] = useState(readPlaybackPreferences);
  const [savedTrackId] = useState(readLastTrackId);
  const [currentTrack, setCurrentTrack] = useState<PlaybackTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrepared, setPrepared] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeMotion = useMotionValue(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(savedPreferences.volume);
  const [isMuted, setMuted] = useState(savedPreferences.volume === 0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(savedPreferences.repeatMode);
  const [isShuffled, setShuffled] = useState(savedPreferences.isShuffled);
  const [unavailableIds, setUnavailableIds] = useState<ReadonlySet<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const cursorRef = useRef<PlaybackCursor<PlaybackTrack> | null>(null);
  const tracksRef = useRef<readonly PlaybackTrack[]>(tracks);
  const currentTrackRef = useRef<PlaybackTrack | null>(null);
  const currentTimeRef = useRef(0);
  const timeUpdateFrameRef = useRef<number | null>(null);
  const savedTrackIdRef = useRef(savedTrackId);
  const pendingYoutubeTrackRef = useRef<PlaybackTrack | null>(null);
  const engineRef = useRef<{
    provider: PlaybackTrack['provider'];
    engine: PlayerEngine;
  } | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  const playRequestRef = useRef(0);
  const playingRef = useRef(false);
  const mutedVolumeRef = useRef(savedPreferences.volume || 0.8);
  const volumeRef = useRef(savedPreferences.volume);
  const repeatModeRef = useRef(savedPreferences.repeatMode);
  const shuffledRef = useRef(savedPreferences.isShuffled);
  const unavailableRef = useRef<ReadonlySet<string>>(new Set());
  const errorHandledIdRef = useRef<string | null>(null);
  const playTrackRef = useRef<(track: PlaybackTrack) => Promise<void>>(async () => undefined);
  const playCurrentRef = useRef<() => void>(() => undefined);
  const advanceRef = useRef<(direction: 'next' | 'previous', autoplay: boolean) => void>(
    () => undefined,
  );
  const previousRef = useRef<() => void>(() => undefined);
  const handleErrorRef = useRef<() => void>(() => undefined);

  const updatePlaybackTime = useCallback(
    (seconds: number) => {
      currentTimeRef.current = seconds;
      setCurrentTime(seconds);
      currentTimeMotion.set(seconds);
    },
    [currentTimeMotion],
  );

  const setPlaying = useCallback((value: boolean) => {
    playingRef.current = value;
    setIsPlaying(value);
  }, []);

  const destroyEngine = useCallback(() => {
    engineRef.current?.engine.destroy();
    engineRef.current = null;
    loadedTrackIdRef.current = null;
    setIsLoading(false);
  }, []);

  const getEngine = useCallback(
    (track: PlaybackTrack): PlayerEngine => {
      if (engineRef.current?.provider === track.provider) return engineRef.current.engine;
      destroyEngine();
      const engine = engineFactory(track.provider, containerRef?.current ?? null);
      engine.setVolume(isMuted ? 0 : volumeRef.current);
      engine.on('timeupdate', (payload) => {
        if (!isPlaybackTime(payload)) return;
        currentTimeRef.current = payload.currentTime;
        setDuration((previous) => (previous === payload.duration ? previous : payload.duration));
        if (timeUpdateFrameRef.current === null) {
          if (typeof requestAnimationFrame === 'function') {
            timeUpdateFrameRef.current = requestAnimationFrame(() => {
              timeUpdateFrameRef.current = null;
              currentTimeMotion.set(currentTimeRef.current);
            });
          } else currentTimeMotion.set(payload.currentTime);
        }
      });
      engine.on('ended', () => {
        if (cursorRef.current?.repeatMode === 'one') {
          engine.seek(0);
          playCurrentRef.current();
          return;
        }
        advanceRef.current('next', true);
      });
      engine.on('error', () => handleErrorRef.current());
      engine.on('statechange', (payload) => {
        if (payload === 'playing') {
          setIsLoading(false);
          setPlaying(true);
        }
        if (payload === 'paused' || payload === 'ended') {
          setIsLoading(false);
          setPlaying(false);
        }
        if (payload === 'buffering') setIsLoading(true);
      });
      engine.on('ready', () => setIsLoading(false));
      engineRef.current = { provider: track.provider, engine };
      return engine;
    },
    [containerRef, currentTimeMotion, destroyEngine, engineFactory, isMuted, setPlaying],
  );

  const playTrack = useCallback(
    async (track: PlaybackTrack): Promise<void> => {
      if (currentTrackRef.current?.id !== track.id) setPrepared(false);
      pendingYoutubeTrackRef.current = null;
      currentTrackRef.current = track;
      setCurrentTrack(track);
      updatePlaybackTime(0);
      setDuration(track.durationSec ?? 0);
      setMessage(null);
      errorHandledIdRef.current = null;
      setIsLoading(true);
      if (track.provider === 'youtube' && containerRef && !containerRef.current) {
        pendingYoutubeTrackRef.current = track;
        return;
      }
      try {
        const engine = getEngine(track);
        const requestId = ++playRequestRef.current;
        if (loadedTrackIdRef.current !== track.id) {
          await engine.load(track);
          if (
            playRequestRef.current !== requestId ||
            currentTrackRef.current?.id !== track.id ||
            engineRef.current?.engine !== engine
          )
            return;
          loadedTrackIdRef.current = track.id;
        }
        if (
          playRequestRef.current !== requestId ||
          currentTrackRef.current?.id !== track.id ||
          engineRef.current?.engine !== engine
        )
          return;
        setPrepared(true);
        await engine.play();
        if (
          playRequestRef.current !== requestId ||
          currentTrackRef.current?.id !== track.id ||
          engineRef.current?.engine !== engine
        )
          return;
        setPlaying(true);
      } catch (error) {
        if (currentTrackRef.current?.id !== track.id || errorName(error) === 'AbortError') return;
        setPlaying(false);
        setIsLoading(false);
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setMessage('El navegador bloqueó la reproducción. Presiona reproducir para continuar.');
        } else if (currentTrackRef.current?.id === track.id) {
          handleErrorRef.current();
        }
      }
    },
    [containerRef, getEngine, setPlaying, updatePlaybackTime],
  );
  playTrackRef.current = playTrack;

  useLayoutEffect(() => {
    const pendingTrack = pendingYoutubeTrackRef.current;
    if (!pendingTrack) return;
    if (pendingTrack.id !== currentTrackRef.current?.id) {
      pendingYoutubeTrackRef.current = null;
      return;
    }
    if (!containerRef?.current) return;

    pendingYoutubeTrackRef.current = null;
    void playTrackRef.current(pendingTrack);
  }, [containerRef, currentTrack]);

  const playCurrent = useCallback(() => {
    const track = currentTrackRef.current ?? cursorRef.current?.current?.value ?? null;
    if (track) void playTrackRef.current(track);
  }, []);
  playCurrentRef.current = playCurrent;

  const advance = useCallback(
    (direction: 'next' | 'previous', autoplay: boolean) => {
      const cursor = cursorRef.current;
      if (!cursor) return;
      const total = tracksRef.current.length;
      const originalRepeat = cursor.repeatMode;
      if (originalRepeat === 'one') cursor.setRepeat('off');

      let candidate = direction === 'next' ? cursor.next() : cursor.prev();
      let attempts = 0;
      while (candidate && unavailableRef.current.has(candidate.id) && attempts < total) {
        attempts += 1;
        candidate = direction === 'next' ? cursor.next() : cursor.prev();
      }
      cursor.setRepeat(originalRepeat);

      if (!candidate || unavailableRef.current.has(candidate.id)) {
        playRequestRef.current += 1;
        engineRef.current?.engine.pause();
        setPlaying(false);
        setIsLoading(false);
        if (unavailableRef.current.size >= total && total > 0)
          setMessage('No hay pistas disponibles en esta playlist.');
        return;
      }
      currentTrackRef.current = candidate.value;
      setCurrentTrack(candidate.value);
      updatePlaybackTime(0);
      if (autoplay) {
        void playTrackRef.current(candidate.value);
      } else {
        engineRef.current?.engine.pause();
        setPlaying(false);
      }
    },
    [setPlaying, updatePlaybackTime],
  );
  advanceRef.current = advance;

  const handleTrackError = useCallback(() => {
    const failedTrack = currentTrackRef.current;
    if (!failedTrack || errorHandledIdRef.current === failedTrack.id) return;
    errorHandledIdRef.current = failedTrack.id;
    const nextUnavailable = new Set(unavailableRef.current);
    nextUnavailable.add(failedTrack.id);
    unavailableRef.current = nextUnavailable;
    setUnavailableIds(nextUnavailable);
    setIsLoading(false);
    if (nextUnavailable.size >= tracksRef.current.length) {
      setMessage('No hay pistas disponibles en esta playlist.');
      setPlaying(false);
      return;
    }
    setMessage('Esta pista no está disponible. Se saltó a la siguiente.');
    advanceRef.current('next', true);
  }, [setPlaying]);
  handleErrorRef.current = handleTrackError;

  useEffect(() => {
    const previousCursor = cursorRef.current;
    const previousCurrent = previousCursor?.current ?? null;
    const previousTrackId = currentTrackRef.current?.id ?? previousCurrent?.id ?? null;
    const ids = new Set(tracks.map((track) => track.id));
    let selected = tracks.find((track) => track.id === previousTrackId) ?? null;
    if (!selected && savedTrackIdRef.current)
      selected = tracks.find((track) => track.id === savedTrackIdRef.current) ?? null;
    let shouldContinue = false;

    if (!selected && previousCurrent) {
      const successorId = previousCurrent.next?.id;
      const previousId = previousCurrent.prev?.id;
      selected =
        tracks.find((track) => track.id === successorId) ??
        tracks.find((track) => track.id === previousId) ??
        null;
      shouldContinue = playingRef.current && Boolean(selected);
    }

    const list = DoublyLinkedList.from(tracks.map((track) => ({ id: track.id, value: track })));
    const cursor = new PlaybackCursor(list);
    if (selected) cursor.jumpTo(selected.id);
    cursor.setRepeat(repeatMode);
    cursor.setShuffle(isShuffled);
    cursorRef.current = cursor;
    tracksRef.current = tracks;
    currentTrackRef.current = selected ?? tracks[0] ?? null;
    if (currentTrackRef.current) savedTrackIdRef.current = currentTrackRef.current.id;
    setCurrentTrack(currentTrackRef.current);
    const nextUnavailable = new Set([...unavailableRef.current].filter((id) => ids.has(id)));
    unavailableRef.current = nextUnavailable;
    setUnavailableIds(nextUnavailable);

    if (!tracks.length) {
      playRequestRef.current += 1;
      destroyEngine();
      updatePlaybackTime(0);
      setDuration(0);
      setPrepared(false);
      setPlaying(false);
      return;
    }
    if (shouldContinue && currentTrackRef.current) {
      void playTrackRef.current(currentTrackRef.current);
    } else if (selected?.id !== previousTrackId && previousTrackId) {
      engineRef.current?.engine.pause();
      destroyEngine();
      setPlaying(false);
      setPrepared(false);
    }
  }, [tracks, destroyEngine, isShuffled, repeatMode, setPlaying, updatePlaybackTime]);

  useEffect(
    () => () => {
      engineRef.current?.engine.destroy();
      engineRef.current = null;
      if (timeUpdateFrameRef.current !== null && typeof cancelAnimationFrame === 'function')
        cancelAnimationFrame(timeUpdateFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!currentTrack) return;
    savedTrackIdRef.current = currentTrack.id;
    writeLastTrackId(currentTrack.id);
  }, [currentTrack?.id]);

  useEffect(() => {
    if (currentTrack?.provider !== 'youtube') return;
    const pauseHiddenPlayback = () => {
      if (document.visibilityState !== 'hidden') return;
      // YouTube's player policy does not allow background playback.
      playRequestRef.current += 1;
      engineRef.current?.engine.pause();
      setPlaying(false);
      setIsLoading(false);
      setMessage(
        'YouTube se pausó al ocultar esta pestaña. La reproducción en segundo plano no está permitida para este reproductor.',
      );
    };
    document.addEventListener('visibilitychange', pauseHiddenPlayback);
    return () => document.removeEventListener('visibilitychange', pauseHiddenPlayback);
  }, [currentTrack, setPlaying]);

  useEffect(() => {
    if (
      !currentTrack ||
      currentTrack.provider === 'youtube' ||
      !('mediaSession' in navigator) ||
      typeof MediaMetadata === 'undefined'
    )
      return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist ?? undefined,
        artwork: currentTrack.thumbnailUrl ? [{ src: currentTrack.thumbnailUrl }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => playCurrentRef.current());
      navigator.mediaSession.setActionHandler('pause', () => engineRef.current?.engine.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => advanceRef.current('next', true));
      navigator.mediaSession.setActionHandler('previoustrack', () => previousRef.current());
    } catch {
      return;
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      } catch {
        return;
      }
    };
  }, [currentTrack]);

  const pause = useCallback(() => {
    playRequestRef.current += 1;
    engineRef.current?.engine.pause();
    setPlaying(false);
  }, [setPlaying]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause();
    else playCurrentRef.current();
  }, [pause]);

  const previous = useCallback(() => {
    if (currentTimeRef.current > 3) {
      engineRef.current?.engine.seek(0);
      updatePlaybackTime(0);
      return;
    }
    const cursor = cursorRef.current;
    // Manual previous bypasses repeat-one in advance; keep the queue head playing in place.
    if (cursor?.current && !cursor.current.prev && cursor.repeatMode !== 'all') {
      engineRef.current?.engine.seek(0);
      updatePlaybackTime(0);
      return;
    }
    advanceRef.current('previous', true);
  }, [updatePlaybackTime]);
  previousRef.current = previous;

  const next = useCallback(() => advanceRef.current('next', true), []);

  const seek = useCallback(
    (seconds: number) => {
      engineRef.current?.engine.seek(seconds);
      updatePlaybackTime(seconds);
    },
    [updatePlaybackTime],
  );

  const setVolume = useCallback((nextVolume: number) => {
    const safeVolume = Math.max(0, Math.min(1, nextVolume));
    setVolumeState(safeVolume);
    volumeRef.current = safeVolume;
    mutedVolumeRef.current = safeVolume || mutedVolumeRef.current;
    setMuted(safeVolume === 0);
    engineRef.current?.engine.setVolume(safeVolume);
    writePlaybackPreferences({
      volume: safeVolume,
      repeatMode: repeatModeRef.current,
      isShuffled: shuffledRef.current,
    });
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) setVolume(mutedVolumeRef.current || 0.8);
    else {
      mutedVolumeRef.current = volume || 0.8;
      setVolume(0);
    }
  }, [isMuted, setVolume, volume]);

  const toggleRepeat = useCallback(() => {
    const nextMode: RepeatMode =
      repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    cursorRef.current?.setRepeat(nextMode);
    repeatModeRef.current = nextMode;
    setRepeatMode(nextMode);
    writePlaybackPreferences({
      volume: volumeRef.current,
      repeatMode: nextMode,
      isShuffled: shuffledRef.current,
    });
  }, [repeatMode]);

  const toggleShuffle = useCallback(() => {
    const nextValue = !isShuffled;
    cursorRef.current?.setShuffle(nextValue);
    shuffledRef.current = nextValue;
    setShuffled(nextValue);
    writePlaybackPreferences({
      volume: volumeRef.current,
      repeatMode: repeatModeRef.current,
      isShuffled: nextValue,
    });
  }, [isShuffled]);

  const selectTrack = useCallback((trackId: string) => {
    const node = cursorRef.current?.jumpTo(trackId);
    if (node) {
      if (unavailableRef.current.has(trackId)) {
        const nextUnavailable = new Set(unavailableRef.current);
        nextUnavailable.delete(trackId);
        unavailableRef.current = nextUnavailable;
        setUnavailableIds(nextUnavailable);
      }
      errorHandledIdRef.current = null;
      setMessage(null);
      currentTrackRef.current = node.value;
      setCurrentTrack(node.value);
      void playTrackRef.current(node.value);
    }
  }, []);

  return {
    currentTrack,
    isPlaying,
    isLoading,
    isPrepared,
    currentTime,
    currentTimeMotion,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    unavailableIds,
    message,
    play: playCurrent,
    pause,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    playTrack: selectTrack,
  };
}

function errorName(error: unknown): string | null {
  return error instanceof Error ? error.name : null;
}
