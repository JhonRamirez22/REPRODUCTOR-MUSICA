import type { Track } from '@reproductor/shared';
import { Icon } from './Icon.js';
import { formatTime } from './PlayerControls.js';

interface QueuePanelProps {
  playlistName: string | null;
  tracks: readonly Track[];
  currentTrackId: string | null;
  unavailableIds: ReadonlySet<string>;
  open: boolean;
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
  onClose,
  onAdd,
  onPlay,
  onMove,
  onRemove,
}: QueuePanelProps) {
  return (
    <aside className={`queue-panel${open ? ' is-open' : ''}`} aria-label="Cola de reproducción">
      <header className="queue-heading">
        <div>
          <h2>Cola de reproducción</h2>
          <p>
            {playlistName ?? 'Elige una playlist'}
            {playlistName ? ` · ${tracks.length} ${tracks.length === 1 ? 'pista' : 'pistas'}` : ''}
          </p>
        </div>
        <button
          className="icon-button queue-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar cola"
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
                      : track.artist ||
                        (track.provider === 'youtube' ? 'YouTube' : 'Audio directo')}
                  </span>
                </button>
                <span className="queue-duration">
                  {track.durationSec ? formatTime(track.durationSec) : '—'}
                </span>
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
