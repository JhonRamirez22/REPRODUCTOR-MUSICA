import type { CSSProperties } from 'react';
import type { PlayerState } from '../player/use-player.js';
import { Icon } from './Icon.js';

interface PlayerControlsProps {
  player: PlayerState;
  disabled?: boolean;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function PlayerControls({ player, disabled = false }: PlayerControlsProps) {
  const progress =
    player.duration > 0 ? Math.min(100, (player.currentTime / player.duration) * 100) : 0;
  const repeatLabel =
    player.repeatMode === 'off'
      ? 'Repetir desactivado'
      : player.repeatMode === 'all'
        ? 'Repetir playlist'
        : 'Repetir pista';

  return (
    <div className="player-controls">
      <div className="progress-row">
        <span className="time-label">{formatTime(player.currentTime)}</span>
        <input
          className="progress-slider"
          type="range"
          min={0}
          max={player.duration || 0}
          step={1}
          value={Math.min(player.currentTime, player.duration || 0)}
          aria-label="Posición de reproducción"
          disabled={disabled || player.duration <= 0}
          style={{ '--range-progress': `${progress}%` } as CSSProperties}
          onChange={(event) => player.seek(Number(event.target.value))}
        />
        <span className="time-label">{formatTime(player.duration)}</span>
      </div>

      <div className="control-row">
        <button
          className={`icon-button control-secondary${player.isShuffled ? ' is-on' : ''}`}
          type="button"
          aria-label={player.isShuffled ? 'Desactivar aleatorio' : 'Activar aleatorio'}
          aria-pressed={player.isShuffled}
          disabled={disabled}
          onClick={player.toggleShuffle}
        >
          <Icon name="shuffle" />
        </button>
        <button
          className="icon-button control-main"
          type="button"
          aria-label="Anterior"
          disabled={disabled}
          onClick={player.previous}
        >
          <Icon name="previous" size={22} />
        </button>
        <button
          className="play-button"
          type="button"
          aria-label={player.isPlaying ? 'Pausar' : 'Reproducir'}
          disabled={disabled || player.isLoading}
          onClick={player.togglePlay}
        >
          <Icon name={player.isPlaying ? 'pause' : 'play'} size={25} />
        </button>
        <button
          className="icon-button control-main"
          type="button"
          aria-label="Siguiente"
          disabled={disabled}
          onClick={player.next}
        >
          <Icon name="next" size={22} />
        </button>
        <button
          className={`icon-button control-secondary${player.repeatMode !== 'off' ? ' is-on' : ''}`}
          type="button"
          aria-label={repeatLabel}
          aria-pressed={player.repeatMode !== 'off'}
          disabled={disabled}
          onClick={player.toggleRepeat}
        >
          <Icon name="repeat" />
          {player.repeatMode === 'one' && (
            <span className="repeat-one-mark" aria-hidden="true">
              1
            </span>
          )}
        </button>
      </div>

      <div className="volume-row">
        <button
          className="icon-button volume-button"
          type="button"
          aria-label={player.isMuted ? 'Activar sonido' : 'Silenciar'}
          onClick={player.toggleMute}
        >
          <Icon name={player.isMuted ? 'mute' : 'volume'} size={18} />
        </button>
        <input
          className="volume-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={player.isMuted ? 0 : player.volume}
          aria-label="Volumen"
          style={
            {
              '--range-progress': `${(player.isMuted ? 0 : player.volume) * 100}%`,
            } as CSSProperties
          }
          onChange={(event) => player.setVolume(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
