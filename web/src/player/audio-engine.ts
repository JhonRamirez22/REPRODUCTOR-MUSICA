import { EventEmitter, type PlayerEngine } from './engine.js';
import type { PlaybackTrack } from './local-track.js';

export class AudioEngine implements PlayerEngine {
  private readonly events = new EventEmitter();
  private readonly audio = new Audio();
  private loadTimeout: ReturnType<typeof setTimeout> | null = null;
  private cancelPendingLoad: (() => void) | null = null;
  private localObjectUrl: string | null = null;

  constructor() {
    this.audio.preload = 'metadata';
    this.audio.addEventListener('loadedmetadata', this.handleReady);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('play', this.handlePlaying);
    this.audio.addEventListener('pause', this.handlePaused);
    this.audio.addEventListener('error', this.handleError);
  }

  async load(track: PlaybackTrack): Promise<void> {
    this.cancelPendingLoad?.();
    this.cancelPendingLoad = null;
    const previousObjectUrl = this.localObjectUrl;
    this.localObjectUrl = null;
    if (track.provider === 'local') {
      this.localObjectUrl = URL.createObjectURL(track.file);
      this.audio.src = this.localObjectUrl;
    } else if (track.provider === 'jamendo') {
      this.audio.src = `/api/catalog/stream/${encodeURIComponent(track.sourceId)}`;
    } else {
      this.audio.src = track.sourceUrl;
    }
    this.audio.load();
    if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);
    if (this.audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      this.emitReady();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        this.clearLoadTimeout();
        this.audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.audio.removeEventListener('error', onLoadError);
        this.cancelPendingLoad = null;
      };
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const onLoadedMetadata = (): void => finish();
      const onLoadError = (): void => finish(new Error('Audio source failed to load.'));
      this.cancelPendingLoad = () =>
        finish(new DOMException('Audio load was superseded.', 'AbortError'));
      this.loadTimeout = setTimeout(() => {
        this.events.emit('error', { message: 'La fuente de audio tardó demasiado.' });
        finish(new Error('Audio metadata timed out.'));
      }, 12_000);
      this.audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      this.audio.addEventListener('error', onLoadError, { once: true });
    });
  }

  async play(): Promise<void> {
    await this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  seek(seconds: number): void {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.audio.currentTime = Math.max(0, Math.min(duration, seconds));
  }

  setVolume(volume01: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume01));
  }

  destroy(): void {
    this.cancelPendingLoad?.();
    this.cancelPendingLoad = null;
    this.clearLoadTimeout();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.revokeLocalObjectUrl();
    this.audio.removeEventListener('loadedmetadata', this.handleReady);
    this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio.removeEventListener('play', this.handlePlaying);
    this.audio.removeEventListener('pause', this.handlePaused);
    this.audio.removeEventListener('error', this.handleError);
    this.events.clear();
  }

  on = this.events.on.bind(this.events);

  private readonly handleReady = (): void => this.emitReady();

  private readonly handleTimeUpdate = (): void => {
    this.events.emit('timeupdate', {
      currentTime: this.audio.currentTime || 0,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
    });
  };

  private readonly handleEnded = (): void => this.events.emit('ended');

  private readonly handlePlaying = (): void => this.events.emit('statechange', 'playing');

  private readonly handlePaused = (): void => this.events.emit('statechange', 'paused');

  private readonly handleError = (): void => {
    this.clearLoadTimeout();
    this.events.emit('error', { message: 'No se pudo reproducir esta fuente de audio.' });
  };

  private emitReady(): void {
    this.clearLoadTimeout();
    this.events.emit('ready');
    this.handleTimeUpdate();
  }

  private clearLoadTimeout(): void {
    if (this.loadTimeout) clearTimeout(this.loadTimeout);
    this.loadTimeout = null;
  }

  private revokeLocalObjectUrl(): void {
    if (!this.localObjectUrl) return;
    URL.revokeObjectURL(this.localObjectUrl);
    this.localObjectUrl = null;
  }
}
