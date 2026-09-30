import { useEffect, useRef } from 'react';
import type { Track } from '@reproductor/shared';
import { Icon } from './Icon.js';
import { formatTime } from './PlayerControls.js';
import { focusMobilePanel, trapMobilePanelFocus } from './mobile-panel.js';

interface QueuePanelProps {
  playlistName: string | null;
  tracks: readonly Track[];
  currentTrackId: string | null;
  unavailableIds: ReadonlySet<string>;
  open: boolean;
  mobileViewport: boolean;
  onClose: () => void;
  onAdd: () => void;
  onPlay: (id: string) => void;
  onMove: (track: Track, toIndex: number) => void;
  onRemove: (track: Track) => void;
}

export function QueuePanel({
  playlistName,
  tracks,
  currentTrackId,
  unavailableIds,
  open,
  mobileViewport,
  onClose,
  onAdd,
  onPlay,
  onMove,
  onRemove,
}: QueuePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && mobileViewport && panelRef.current) focusMobilePanel(panelRef.current);
  }, [mobileViewport, open]);

  return (
    <aside
      ref={panelRef}
      id="queue-panel"
      className={`queue-panel${open ? ' is-open' : ''}`}
      aria-label="Cola de reproducción"
      aria-hidden={mobileViewport && !open ? true : undefined}
      aria-modal={mobileViewport && open ? true : undefined}
      inert={mobileViewport && !open ? true : undefined}
      role={mobileViewport && open ? 'dialog' : undefined}
      tabIndex={mobileViewport && open ? -1 : undefined}
      onKeyDown={(event) => {
        if (mobileViewport && open && panelRef.current)
          trapMobilePanelFocus(event, panelRef.current, onClose);
      }}
    >
      <header className="queue-heading">
        <div>
          <h2>Cola de reproducción</h2>
          <p>
            {playlistName ?? 'Elige una playlist'}
            {playlistName ? ` · ${tracks.length} ${tracks.length === 1 ? 'pista' : 'pistas'}` : ''}
          </p>
        </div>
        <button
          ref={closeButtonRef}
          className="icon-button queue-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar cola"
          data-panel-initial-focus
        >
          <Icon name="close" />
        </button>
      </header>

      {!playlistName ? (
        <div className="queue-empty">
          <p>Elige una playlist para ver su cola.</p>
        </div>
      ) : tracks.length === 0 ? (
        <div className="queue-empty">
          <p>Las pistas que agregues aparecerán aquí.</p>
          <button className="text-button" type="button" onClick={onAdd}>
            Agregar una pista
          </button>
        </div>
      ) : (
        <ol className="queue-list" aria-label={`Pistas de ${playlistName}`}>
          {tracks.map((track, position) => {
            const current = track.id === currentTrackId;
            const unavailable = unavailableIds.has(track.id);
            return (
              <li
                className={`queue-item${current ? ' is-current' : ''}${unavailable ? ' is-unavailable' : ''}`}
                key={track.id}
                aria-current={current ? 'true' : undefined}
              >
                <span className="queue-position" aria-hidden="true">
                  {String(position + 1).padStart(2, '0')}
                </span>
                <button
                  className="queue-track"
                  type="button"
                  onClick={() => onPlay(track.id)}
                  aria-label={`Reproducir ${track.title}`}
                >
                  <span className="queue-track-title">{track.title}</span>
                  <span className="queue-track-subtitle">
                    {unavailable
                      ? 'Esta pista no está disponible'
                      : track.artist || providerLabel(track.provider)}
                  </span>
                </button>
                {track.provider === 'jamendo' ? (
                  <a
                    className="queue-duration queue-source-link"
                    href={track.attributionUrl ?? track.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir la ficha de ${track.title} en Jamendo`}
                  >
                    <span>{track.durationSec ? formatTime(track.durationSec) : '—'}</span>
                    <span>Jamendo</span>
                  </a>
                ) : (
                  <span className="queue-duration">
                    {track.durationSec ? formatTime(track.durationSec) : '—'}
                  </span>
                )}
                <div className="queue-actions">
                  <button
                    className="icon-button compact"
                    type="button"
                    aria-label={`Subir ${track.title}`}
                    disabled={position === 0}
                    onClick={() => onMove(track, position - 1)}
                  >
                    <Icon name="up" size={16} />
                  </button>
                  <button
                    className="icon-button compact"
                    type="button"
                    aria-label={`Bajar ${track.title}`}
                    disabled={position === tracks.length - 1}
                    onClick={() => onMove(track, position + 1)}
                  >
                    <Icon name="down" size={16} />
                  </button>
                  <button
                    className="icon-button compact danger-action"
                    type="button"
                    aria-label={`Quitar ${track.title}`}
                    onClick={() => onRemove(track)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {playlistName && tracks.length > 0 && (
        <button className="queue-add-button" type="button" onClick={onAdd}>
          <Icon name="plus" size={17} /> Agregar una pista
        </button>
      )}
    </aside>
  );
}

function providerLabel(provider: Track['provider']): string {
  if (provider === 'youtube') return 'YouTube Music';
  if (provider === 'jamendo') return 'Jamendo';
  return 'Audio directo';
}
