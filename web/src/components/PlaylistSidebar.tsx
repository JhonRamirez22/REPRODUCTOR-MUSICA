import { useEffect, useRef } from 'react';
import type { AuthUser, PlaylistSummary } from '@reproductor/shared';
import { Icon } from './Icon.js';
import { focusMobilePanel, trapMobilePanelFocus } from './mobile-panel.js';

interface PlaylistSidebarProps {
  open: boolean;
  mobileViewport: boolean;
  playlists: PlaylistSummary[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  user: AuthUser | null;
  authLoading: boolean;
  authActionLoading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (playlist: PlaylistSummary) => void;
  onDelete: (playlist: PlaylistSummary) => void;
  onRetry: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onClose: () => void;
}

export function PlaylistSidebar({
  open,
  mobileViewport,
  playlists,
  selectedId,
  loading,
  error,
  user,
  authLoading,
  authActionLoading,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onRetry,
  onOpenAuth,
  onLogout,
  onClose,
}: PlaylistSidebarProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && mobileViewport && panelRef.current) focusMobilePanel(panelRef.current);
  }, [mobileViewport, open]);

  return (
    <aside
      ref={panelRef}
      id="playlist-sidebar"
      className={`sidebar${open ? ' mobile-open' : ''}`}
      aria-label="Navegación de playlists"
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
      <div className="sidebar-topline">
        <a className="brand" href="#inicio" aria-label="Reproductor, inicio">
          <span className="brand-mark">
            <Icon name="brand" size={23} />
          </span>
          <span>Reproductor</span>
        </a>
        <button
          ref={closeButtonRef}
          className="icon-button sidebar-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar navegación"
          data-panel-initial-focus
        >
          <Icon name="close" />
        </button>
      </div>

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

      <section className="account-area" aria-label="Cuenta">
        {authLoading ? (
          <p className="account-copy" role="status">
            Comprobando sesión…
          </p>
        ) : user ? (
          <>
            <h2 className="account-heading">Tu cuenta</h2>
            <p className="account-email">{user.email}</p>
            <p className={`account-sync${error ? ' account-sync-error' : ''}`} role="status">
              {loading
                ? 'Consultando tus playlists…'
                : error
                  ? 'No se pudo actualizar la biblioteca.'
                  : 'Tus playlists están sincronizadas en la nube.'}
            </p>
            <button
              className="text-button account-action"
              type="button"
              onClick={onLogout}
              disabled={authActionLoading}
            >
              {authActionLoading ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </>
        ) : (
          <>
            <h2 className="account-heading">Sincroniza tus playlists</h2>
            <p className="account-copy">
              {playlists.length > 0
                ? 'Crea una cuenta para abrir estas playlists en otros dispositivos.'
                : 'Inicia sesión para cargar tu biblioteca o crea una cuenta para guardarla en la nube.'}
            </p>
            <div className="account-actions">
              <button
                className="button button-primary account-create"
                type="button"
                onClick={() => onOpenAuth('register')}
                disabled={authActionLoading}
              >
                Crear cuenta
              </button>
              <button
                className="text-button account-action"
                type="button"
                onClick={() => onOpenAuth('login')}
                disabled={authActionLoading}
              >
                Iniciar sesión
              </button>
            </div>
          </>
        )}
      </section>

      <div className="sidebar-footnote">
        <span className="footnote-rule" />
        <p>El audio permanece en su fuente original.</p>
      </div>
    </aside>
  );
}
