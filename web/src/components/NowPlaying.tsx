import type { RefObject } from 'react';
import type { Playlist } from '@reproductor/shared';
import type { PlayerState } from '../player/use-player.js';
import type { PlaybackTrack } from '../player/local-track.js';
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
          <section className="track-stage" aria-label="Pista actual">
            {track.provider === 'youtube' ? (
              <>
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
              </>
            ) : track.thumbnailUrl ? (
              <img
                className="audio-artwork"
                src={track.thumbnailUrl}
                alt={`Carátula de ${track.title}`}
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
          </section>

          <section className="track-information" aria-live="polite" aria-atomic="true">
            <div className="track-copy">
              <h2 className={player.unavailableIds.has(track.id) ? 'is-unavailable' : ''}>
                {track.title}
              </h2>
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
            </div>
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
            disabled={!track || player.unavailableIds.has(track.id)}
          />
          <p className="keyboard-shortcuts">
            Atajos: <kbd>Espacio</kbd> reproduce o pausa · <kbd>←</kbd>/<kbd>→</kbd> cambia de pista
            · <kbd>M</kbd> silencia
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
