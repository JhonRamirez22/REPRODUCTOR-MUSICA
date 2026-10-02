import { useEffect, useRef, type CSSProperties } from 'react';
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import type { PlayerState } from '../player/use-player.js';
import { Icon } from './Icon.js';

interface PlayerControlsProps {
  player: PlayerState;
  disabled?: boolean;
  playDisabled?: boolean;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function PlayerControls({
  player,
  disabled = false,
  playDisabled = false,
}: PlayerControlsProps) {
  const shouldReduceMotion = useReducedMotion();
  const canHover =
    typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches === true;
  const repeatLabel =
    player.repeatMode === 'off'
      ? 'Repetir desactivado'
      : player.repeatMode === 'all'
        ? 'Repetir playlist'
        : 'Repetir pista';

  return (
    <div className="player-controls">
      <div className="progress-row">
        <ProgressReadout player={player} />
        <span className="time-label tw:tabular-nums">{formatTime(player.duration)}</span>
      </div>

      <div className="control-row">
        <motion.button
          className={`icon-button control-secondary${player.isShuffled ? ' is-on' : ''}`}
          type="button"
          aria-label={player.isShuffled ? 'Desactivar aleatorio' : 'Activar aleatorio'}
          aria-pressed={player.isShuffled}
          disabled={disabled}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
          whileHover={canHover && !shouldReduceMotion ? { scale: 1.04 } : undefined}
          onClick={player.toggleShuffle}
        >
          <Icon name="shuffle" />
        </motion.button>
        <motion.button
          className="icon-button control-main"
          type="button"
          aria-label="Anterior"
          disabled={disabled}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
          whileHover={canHover && !shouldReduceMotion ? { scale: 1.04 } : undefined}
          onClick={player.previous}
        >
          <Icon name="previous" size={22} />
        </motion.button>
        <motion.button
          className="play-button"
          type="button"
          aria-label={player.isPlaying ? 'Pausar' : 'Reproducir'}
          disabled={disabled || playDisabled || player.isLoading}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
          whileHover={canHover && !shouldReduceMotion ? { scale: 1.04 } : undefined}
          onClick={player.togglePlay}
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={player.isPlaying ? 'pause' : 'play'}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, rotate: -12 }
              }
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, rotate: 12 }}
              transition={shouldReduceMotion ? { duration: 0.15 } : undefined}
            >
              <Icon name={player.isPlaying ? 'pause' : 'play'} size={25} />
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <motion.button
          className="icon-button control-main"
          type="button"
          aria-label="Siguiente"
          disabled={disabled}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
          whileHover={canHover && !shouldReduceMotion ? { scale: 1.04 } : undefined}
          onClick={player.next}
        >
          <Icon name="next" size={22} />
        </motion.button>
        <motion.button
          className={`icon-button control-secondary${player.repeatMode !== 'off' ? ' is-on' : ''}`}
          type="button"
          aria-label={repeatLabel}
          aria-pressed={player.repeatMode !== 'off'}
          disabled={disabled}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
          whileHover={canHover && !shouldReduceMotion ? { scale: 1.04 } : undefined}
          onClick={player.toggleRepeat}
        >
          <Icon name="repeat" />
          {player.repeatMode === 'one' && (
            <span className="repeat-one-mark" aria-hidden="true">
              1
            </span>
          )}
        </motion.button>
      </div>

      <div className="volume-row">
        <motion.button
          className="icon-button volume-button"
          type="button"
          aria-label={player.isMuted ? 'Activar sonido' : 'Silenciar'}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
          whileHover={canHover && !shouldReduceMotion ? { scale: 1.04 } : undefined}
          onClick={player.toggleMute}
        >
          <Icon name={player.isMuted ? 'mute' : 'volume'} size={18} />
        </motion.button>
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

function ProgressReadout({ player }: { player: PlayerState }) {
  const sliderRef = useRef<HTMLInputElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const playhead = useMotionValue(player.currentTimeMotion.get());
  const timingRef = useRef({
    seconds: player.currentTimeMotion.get(),
    timestamp: performance.now(),
  });
  const progress = useTransform(playhead, (seconds) => {
    if (player.duration <= 0) return '0%';
    return `${Math.min(100, Math.max(0, (seconds / player.duration) * 100))}%`;
  });

  useEffect(() => {
    const paintTime = (seconds: number): void => {
      const safeTime = Math.max(0, Math.min(seconds, player.duration || 0));
      const input = sliderRef.current;
      if (input) {
        input.value = String(safeTime);
        input.setAttribute('aria-valuenow', String(Math.floor(safeTime)));
        input.setAttribute(
          'aria-valuetext',
          `${formatTime(safeTime)} de ${formatTime(player.duration)}`,
        );
      }
      if (elapsedRef.current) elapsedRef.current.textContent = formatTime(safeTime);
    };

    const unsubscribe = player.currentTimeMotion.on('change', (seconds) => {
      timingRef.current = { seconds, timestamp: performance.now() };
      playhead.set(seconds);
      paintTime(seconds);
    });
    playhead.set(player.currentTimeMotion.get());
    paintTime(player.currentTimeMotion.get());
    return unsubscribe;
  }, [player.currentTimeMotion, player.duration, playhead]);

  useAnimationFrame((timestamp) => {
    if (!player.isPlaying || player.duration <= 0) return;
    const elapsed = Math.max(0, (timestamp - timingRef.current.timestamp) / 1000);
    const seconds = Math.min(player.duration, timingRef.current.seconds + elapsed);
    playhead.set(seconds);
    const input = sliderRef.current;
    if (input) {
      input.value = String(seconds);
      input.setAttribute('aria-valuenow', String(Math.floor(seconds)));
      input.setAttribute(
        'aria-valuetext',
        `${formatTime(seconds)} de ${formatTime(player.duration)}`,
      );
    }
    if (elapsedRef.current) elapsedRef.current.textContent = formatTime(seconds);
  });

  return (
    <>
      <span ref={elapsedRef} className="time-label tw:tabular-nums">
        {formatTime(player.currentTimeMotion.get())}
      </span>
      <motion.input
        ref={sliderRef}
        className="progress-slider"
        type="range"
        min={0}
        max={player.duration || 0}
        step={0.1}
        defaultValue={player.currentTime}
        role="slider"
        aria-label="Posición de reproducción"
        aria-valuemin={0}
        aria-valuemax={player.duration}
        aria-valuenow={Math.floor(player.currentTimeMotion.get())}
        aria-valuetext={`${formatTime(player.currentTimeMotion.get())} de ${formatTime(player.duration)}`}
        disabled={!player.currentTrack || player.duration <= 0}
        style={{ '--range-progress': progress } as unknown as CSSProperties}
        onChange={(event) => player.seek(Number(event.target.value))}
      />
    </>
  );
}
