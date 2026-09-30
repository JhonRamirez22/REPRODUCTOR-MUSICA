import type { PlaylistSummary } from '@reproductor/shared';
import { Icon } from './Icon.js';

interface PlaylistSidebarProps {
  open: boolean;
  playlists: PlaylistSummary[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (playlist: PlaylistSummary) => void;
  onDelete: (playlist: PlaylistSummary) => void;
  onRetry: () => void;
}

export function PlaylistSidebar({
  open,
  playlists,
  selectedId,
  loading,
  error,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onRetry,
}: PlaylistSidebarProps) {
  return (
    <aside className={`sidebar${open ? ' mobile-open' : ''}`} aria-label="Navegación de playlists">
      <a className="brand" href="#inicio" aria-label="Reproductor, inicio">
        <span className="brand-mark">
          <Icon name="brand" size={23} />
        </span>
        <span>Reproductor</span>
      </a>

      <div className="sidebar-section-heading">
        <h2>Tus playlists</h2>
        <button
          className="icon-button sidebar-add"
          type="button"
          onClick={onCreate}
          aria-label="Crear playlist"
        >
          <Icon name="plus" />
        </button>
      </div>

      {error ? (
        <div className="sidebar-feedback" role="alert">
          <p>{error}</p>
          <button className="text-button" type="button" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <div className="playlist-skeleton" aria-label="Cargando playlists" aria-busy="true">
          <span />
          <span />
          <span />
        </div>
      ) : playlists.length === 0 ? (
        <div className="sidebar-empty">
          <p>Aún no hay playlists.</p>
          <button className="text-button" type="button" onClick={onCreate}>
            Crear la primera
          </button>
        </div>
      ) : (
        <ul className="playlist-nav">
          {playlists.map((playlist) => (
            <li key={playlist.id} className="playlist-nav-item">
              <button
                className={`playlist-link${selectedId === playlist.id ? ' is-active' : ''}`}
                type="button"
                aria-current={selectedId === playlist.id ? 'page' : undefined}
                onClick={() => onSelect(playlist.id)}
              >
                <Icon name="music" size={18} />
                <span className="playlist-link-copy">
                  <span className="playlist-link-name">{playlist.name}</span>
                  <span className="playlist-link-count">
                    {playlist.trackCount} {playlist.trackCount === 1 ? 'pista' : 'pistas'}
                  </span>
                </span>
              </button>
              {selectedId === playlist.id && (
                <span className="playlist-actions">
                  <button
                    className="icon-button compact"
                    type="button"
                    aria-label={`Renombrar ${playlist.name}`}
                    onClick={() => onRename(playlist)}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    className="icon-button compact danger-action"
                    type="button"
                    aria-label={`Eliminar ${playlist.name}`}
                    onClick={() => onDelete(playlist)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="sidebar-footnote">
        <span className="footnote-rule" />
        <p>El audio permanece en su fuente original.</p>
      </div>
    </aside>
  );
}
