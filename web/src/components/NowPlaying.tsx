import { useEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Playlist } from '@reproductor/shared';
import type { PlayerState } from '../player/use-player.js';
import type { PlaybackTrack } from '../player/local-track.js';
import { dominantAccent } from '../design/accent-color.js';
import { PlayerControls } from './PlayerControls.js';
import { Icon } from './Icon.js';
import { LocalFilesButton } from './LocalFilesButton.js';

interface NowPlayingProps {
  playlist: Playlist | null;
  tracks: readonly PlaybackTrack[];
  player: PlayerState;
  playerContainerRef: RefObject<HTMLDivElement | null>;
  mobileExpanded: boolean;
  loading: boolean;
  error: string | null;
  onAddTrack: () => void;
  onAddLocalFiles: (files: File[]) => void;
  onCreatePlaylist: () => void;
  onRetry: () => void;
  onCollapseMobilePlayer: () => void;
  mobileCollapseButtonRef: RefObject<HTMLButtonElement | null>;
}

export function NowPlaying({
  playlist,
  tracks,
  player,
  playerContainerRef,
  mobileExpanded,
  loading,
  error,
  onAddTrack,
  onAddLocalFiles,
  onCreatePlaylist,
  onRetry,
  onCollapseMobilePlayer,
  mobileCollapseButtonRef,
}: NowPlayingProps) {
  const track = player.currentTrack;
  const shouldReduceMotion = useReducedMotion();
  const previousTrackId = useRef<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [accent, setAccent] = useState('#c7a876');

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    return () => document.documentElement.style.setProperty('--accent', '#c7a876');
  }, [accent]);

  useEffect(() => {
    const previousId = previousTrackId.current;
    if (track && previousId && previousId !== track.id) {
      const previousIndex = tracks.findIndex((item) => item.id === previousId);
      const nextIndex = tracks.findIndex((item) => item.id === track.id);
      if (previousIndex >= 0 && nextIndex >= 0) setDirection(nextIndex < previousIndex ? -1 : 1);
    }
    previousTrackId.current = track?.id ?? null;
  }, [track?.id, tracks]);

  useEffect(() => {
    let active = true;
    setAccent('#c7a876');
    if (!track?.thumbnailUrl)
      return () => {
        active = false;
      };
    void dominantAccent(track.thumbnailUrl).then((value) => {
      if (active && value) setAccent(value);
    });
    return () => {
      active = false;
    };
  }, [track?.thumbnailUrl]);

  return (
    <main className={`now-playing${mobileExpanded ? ' mobile-player-expanded' : ''}`} id="inicio">
      <header className="content-heading">
        <div>
          <h1>En reproducción</h1>
          <p>
            {playlist
              ? playlist.name
              : tracks.some((item) => item.provider === 'local')
                ? 'Archivos locales'
                : 'Tu biblioteca personal'}
          </p>
        </div>
        <div className="content-heading-actions">
          {tracks.length > 0 && (
            <button
              className="button button-quiet add-track-top"
              type="button"
              onClick={onAddTrack}
            >
              <Icon name="plus" size={18} />
              <span>Agregar música</span>
            </button>
          )}
          {mobileExpanded && (
            <button
              ref={mobileCollapseButtonRef}
              className="button button-quiet mobile-player-collapse"
              type="button"
              aria-label="Contraer reproductor"
              title="Contraer reproductor"
              onClick={onCollapseMobilePlayer}
            >
              <Icon name="down" size={18} />
              <span>Contraer reproductor</span>
            </button>
          )}
        </div>
      </header>

      {error ? (
        <section className="main-feedback" role="alert">
          <h2>No se pudo cargar esta playlist</h2>
          <p>{error}</p>
          <button className="button button-quiet" type="button" onClick={onRetry}>
            <Icon name="refresh" size={17} /> Reintentar
          </button>
        </section>
      ) : loading ? (
        <section className="playing-skeleton" aria-label="Cargando playlist" aria-busy="true">
          <div className="skeleton-stage" />
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-meta" />
          <div className="skeleton-controls" />
        </section>
      ) : !playlist && tracks.length === 0 ? (
        <section className="empty-state library-empty">
          <div className="empty-mark" aria-hidden="true">
            <Icon name="brand" size={34} />
          </div>
          <h2>Empieza con una playlist</h2>
          <p>Crea una playlist para guardar música o reproduce archivos desde este dispositivo.</p>
          <div className="empty-state-actions">
            <button className="button button-primary" type="button" onClick={onCreatePlaylist}>
              Crear playlist
            </button>
            <LocalFilesButton onSelectFiles={onAddLocalFiles} />
          </div>
        </section>
      ) : tracks.length === 0 ? (
        <section className="empty-state track-empty">
          <div className="empty-record" aria-hidden="true">
            <span />
          </div>
          <h2>Tu playlist está vacía</h2>
          <p>Busca una canción en YouTube Music y aparecerá aquí, lista para reproducirse.</p>
          <button className="button button-primary" type="button" onClick={onAddTrack}>
            <Icon name="plus" size={18} /> Agregar una pista
          </button>
        </section>
      ) : track ? (
        <>
          <section
            className={`track-stage${track.provider === 'youtube' ? ' youtube-stage' : ''}`}
            aria-label="Pista actual"
          >
            <AnimatePresence initial={false} mode="popLayout" custom={direction}>
              <motion.div
                key={track.id}
                className="cover-motion"
                custom={direction}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * 20, scale: 0.96, filter: 'blur(8px)' }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: player.isPlaying ? 1 : 0.94,
                  filter: 'blur(0px)',
                }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * -20, scale: 0.96, filter: 'blur(8px)' }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.15 }
                    : { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }
                }
                layoutId="current-cover"
              >
                {track.thumbnailUrl ? (
                  <img
                    className="audio-artwork"
                    src={track.thumbnailUrl}
                    alt={`Carátula de ${track.title}`}
                    width={420}
                    height={420}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className="audio-artwork artwork-placeholder"
                    role="img"
                    aria-label="Esta pista no tiene carátula"
                  >
                    <span className="artwork-disc">
                      <i />
                    </span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            {track.provider === 'youtube' && (
              <div className="youtube-embed-frame">
                <div
                  className="youtube-frame"
                  ref={playerContainerRef}
                  aria-label="Reproductor de video de YouTube"
                />
                {!player.isPrepared && (
                  <div className="video-placeholder" aria-hidden="true">
                    <Icon name="play" size={28} />
                    <span>Presiona reproducir para cargar el video</span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="track-information" aria-live="polite" aria-atomic="true">
            <AnimatePresence initial={false} mode="popLayout" custom={direction}>
              <motion.div
                className="track-copy"
                key={track.id}
                custom={direction}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -12 }}
                transition={shouldReduceMotion ? { duration: 0.15 } : undefined}
              >
                <motion.h2
                  className={player.unavailableIds.has(track.id) ? 'is-unavailable' : ''}
                  layoutId="current-track-title"
                >
                  {track.title}
                </motion.h2>
                <p>{track.artist || providerLabel(track.provider)}</p>
                {track.provider === 'jamendo' && (
                  <div className="track-attribution">
                    <a
                      href={track.attributionUrl ?? track.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir ficha en Jamendo
                    </a>
                    {track.licenseUrl && (
                      <a href={track.licenseUrl} target="_blank" rel="noreferrer">
                        Licencia Creative Commons
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            {track.provider === 'jamendo' ? (
              <a
                className="source-chip"
                href={track.attributionUrl ?? track.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Jamendo
              </a>
            ) : (
              <span className="source-chip">{providerLabel(track.provider)}</span>
            )}
          </section>

          {player.message && (
            <p className="player-message" role="status">
              {player.message}
            </p>
          )}
          <PlayerControls
            player={player}
            disabled={!track}
            playDisabled={Boolean(track && player.unavailableIds.has(track.id))}
          />
          <p className="keyboard-shortcuts">
            Atajos: <kbd>Espacio</kbd> reproduce o pausa · <kbd>←</kbd>/<kbd>→</kbd> busca 5 s ·
            <kbd>Mayús</kbd> + flechas cambia de pista · <kbd>↑</kbd>/<kbd>↓</kbd> ajusta volumen ·{' '}
            <kbd>M</kbd> silencia
          </p>
        </>
      ) : null}
    </main>
  );
}

function providerLabel(provider: PlaybackTrack['provider']): string {
  if (provider === 'youtube') return 'YouTube Music';
  if (provider === 'jamendo') return 'Jamendo';
  if (provider === 'local') return 'Archivo local';
  return 'Audio directo';
}
