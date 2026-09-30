import type { Track } from '@reproductor/shared';
import { EventEmitter, type PlayerEngine } from './engine.js';

interface YouTubePlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YouTubeNamespace {
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
  Player: new (
    target: HTMLElement,
    options: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('YouTube player API timed out.')), 10_000);
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube player API did not initialize.'));
    };

    let script = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('YouTube player API could not be loaded.'));
      };
      document.head.append(script);
    }
  }).catch((error: unknown) => {
    apiPromise = null;
    throw error;
  });
  return apiPromise;
}

export class YouTubeEngine implements PlayerEngine {
  private readonly events = new EventEmitter();
  private readonly host: HTMLDivElement;
  private player: YouTubePlayer | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private pendingLoadTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingLoad: (() => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private destroyed = false;

  constructor(private readonly container: HTMLElement) {
    this.host = document.createElement('div');
    this.host.className = 'youtube-player-host';
    this.container.replaceChildren(this.host);
  }

  async load(track: Track): Promise<void> {
    if (this.destroyed) throw new DOMException('Player was destroyed.', 'AbortError');
    const api = await loadYouTubeApi();
    if (this.destroyed) throw new DOMException('Player was destroyed.', 'AbortError');
    if (this.player) {
      this.player.loadVideoById(track.sourceId);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.pendingLoad = resolve;
      this.pendingReject = reject;
      this.pendingLoadTimer = setTimeout(() => {
        this.pendingReject?.(new Error('YouTube player did not become ready.'));
        this.pendingLoadTimer = null;
        this.pendingReject = null;
        this.pendingLoad = null;
      }, 10_000);
      const player = new api.Player(this.host, {
        width: '100%',
        height: '100%',
        videoId: track.sourceId,
        playerVars: {
          playsinline: 1,
          origin: window.location.origin,
          rel: 0,
        },
        events: {
          onReady: () => {
            this.clearPendingLoadTimer();
            this.pendingLoad?.();
            this.pendingLoad = null;
            this.pendingReject = null;
            this.events.emit('ready');
          },
          onStateChange: (event) => this.handleStateChange(event.data, api),
          onError: (event) => {
            this.clearPendingLoadTimer();
            this.pendingReject?.(new Error(`YouTube player error ${event.data}.`));
            this.pendingReject = null;
            this.pendingLoad = null;
            this.events.emit('error', { code: event.data });
          },
        },
      });
      this.player = player;
    });
  }

  async play(): Promise<void> {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    this.player?.seekTo(Math.max(0, seconds), true);
  }

  setVolume(volume01: number): void {
    this.player?.setVolume(Math.round(Math.max(0, Math.min(1, volume01)) * 100));
  }

  destroy(): void {
    this.destroyed = true;
    this.clearPendingLoadTimer();
    this.pendingReject?.(new DOMException('Player was destroyed.', 'AbortError'));
    this.pendingReject = null;
    this.pendingLoad = null;
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    this.player?.destroy();
    this.player = null;
    this.container.replaceChildren();
    this.events.clear();
  }

  on = this.events.on.bind(this.events);

  private handleStateChange(state: number, api: YouTubeNamespace): void {
    if (state === api.PlayerState.ENDED) {
      this.stopPolling();
      this.events.emit('ended');
      this.events.emit('statechange', 'ended');
    } else if (state === api.PlayerState.PLAYING) {
      this.startPolling();
      this.events.emit('statechange', 'playing');
    } else if (state === api.PlayerState.PAUSED) {
      this.stopPolling();
      this.events.emit('statechange', 'paused');
    } else if (state === api.PlayerState.BUFFERING || state === api.PlayerState.CUED) {
      this.events.emit('statechange', 'buffering');
    }
  }

  private startPolling(): void {
    if (this.poll) return;
    this.poll = setInterval(() => {
      if (!this.player) return;
      this.events.emit('timeupdate', {
        currentTime: this.player.getCurrentTime() || 0,
        duration: this.player.getDuration() || 0,
      });
    }, 1_000);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  private clearPendingLoadTimer(): void {
    if (this.pendingLoadTimer) clearTimeout(this.pendingLoadTimer);
    this.pendingLoadTimer = null;
  }
}
