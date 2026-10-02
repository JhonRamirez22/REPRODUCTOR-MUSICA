import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DoublyLinkedList,
  type AddTrackRequest,
  type AuthUser,
  type Playlist,
  type PlaylistSummary,
  type Track,
} from '@reproductor/shared';
import { AddTrackDialog } from './components/AddTrackDialog.js';
import { AuthDialog, type AuthMode } from './components/AuthDialog.js';
import { Icon } from './components/Icon.js';
import { NowPlaying } from './components/NowPlaying.js';
import { PlaylistNameDialog } from './components/PlaylistNameDialog.js';
import { PlaylistSidebar } from './components/PlaylistSidebar.js';
import { QueuePanel } from './components/QueuePanel.js';
import { api, ApiError } from './api/client.js';
import { createLocalTracks, type LocalTrack, type PlaybackTrack } from './player/local-track.js';
import { usePlayer } from './player/use-player.js';
import './styles/tokens.css';
import './styles/base.css';

type NameDialogMode = 'create' | 'rename';
const EMPTY_TRACKS: readonly Track[] = [];
const EMPTY_LOCAL_TRACKS: LocalTrack[] = [];
const EMPTY_LOCAL_TRACK_MAP: Record<string, LocalTrack[]> = {};

interface LocalFileResult {
  added: number;
  rejected: number;
}

function readLastPlaylistId(): string | null {
  try {
    return window.localStorage.getItem('reproductor:last-playlist');
  } catch {
    return null;
  }
}

function saveLastPlaylistId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem('reproductor:last-playlist', id);
    else window.localStorage.removeItem('reproductor:last-playlist');
  } catch {
    return;
  }
}

function summaryOf(playlist: Playlist): PlaylistSummary {
  return {
    id: playlist.id,
    name: playlist.name,
    revision: playlist.revision,
    trackCount: playlist.trackCount,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
}

function App() {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localTracksByPlaylist, setLocalTracksByPlaylist] =
    useState<Record<string, LocalTrack[]>>(EMPTY_LOCAL_TRACK_MAP);
  const [standaloneLocalTracks, setStandaloneLocalTracks] =
    useState<LocalTrack[]>(EMPTY_LOCAL_TRACKS);
  const [nameDialog, setNameDialog] = useState<{
    mode: NameDialogMode;
    playlist?: PlaylistSummary;
  } | null>(null);
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState<AuthMode | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobilePlayerExpanded, setMobilePlayerExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(
    () => window.matchMedia('(max-width: 940px)').matches,
  );
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const queueTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileExpandButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCollapseButtonRef = useRef<HTMLButtonElement>(null);
  const playlistLoadVersion = useRef(0);
  const activeLocalTracks = activePlaylist
    ? (localTracksByPlaylist[activePlaylist.id] ?? EMPTY_LOCAL_TRACKS)
    : standaloneLocalTracks;
  const tracks: readonly PlaybackTrack[] = useMemo(
    () => [...(activePlaylist?.tracks ?? EMPTY_TRACKS), ...activeLocalTracks],
    [activePlaylist?.tracks, activeLocalTracks],
  );
  const player = usePlayer(tracks, playerContainerRef);
  const playerRef = useRef(player);
  const mobilePlayerExpandedRef = useRef(mobilePlayerExpanded);
  const previousMobilePanels = useRef({ nav: false, queue: false });
  playerRef.current = player;
  mobilePlayerExpandedRef.current = mobilePlayerExpanded;

  const loadPlaylist = useCallback(async (playlistId: string): Promise<void> => {
    const version = ++playlistLoadVersion.current;
    setPlaylistLoading(true);
    setPlaylistError(null);
    try {
      const playlist = await api.getPlaylist(playlistId);
      if (version !== playlistLoadVersion.current) return;
      setActivePlaylist(playlist);
      saveLastPlaylistId(playlist.id);
      setPlaylistLoading(false);
    } catch (error) {
      if (version !== playlistLoadVersion.current) return;
      setPlaylistError(error instanceof Error ? error.message : 'No se pudo cargar la playlist.');
      setPlaylistLoading(false);
    }
  }, []);

  const loadPlaylists = useCallback(
    async (preferredId?: string): Promise<boolean> => {
      setPlaylistsLoading(true);
      setPlaylistsError(null);
      try {
        const result = await api.listPlaylists();
        setPlaylists(result);
        const storedId = preferredId ?? readLastPlaylistId();
        const selected = result.find((playlist) => playlist.id === storedId) ?? result[0];
        if (selected) await loadPlaylist(selected.id);
        else {
          playlistLoadVersion.current += 1;
          setActivePlaylist(null);
          setPlaylistLoading(false);
          saveLastPlaylistId(null);
        }
        return true;
      } catch (error) {
        setPlaylistsError(
          error instanceof Error ? error.message : 'No se pudieron cargar las playlists.',
        );
        return false;
      } finally {
        setPlaylistsLoading(false);
      }
    },
    [loadPlaylist],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await api.authSession();
        if (!active) return;
        setAuthUser(session.user);
        await loadPlaylists();
      } catch (error) {
        if (!active) return;
        setPlaylistsError(
          error instanceof Error ? error.message : 'No se pudo comprobar la cuenta.',
        );
        setPlaylistsLoading(false);
      } finally {
        if (active) setAuthLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadPlaylists]);

  async function submitAuth(mode: AuthMode, email: string, password: string): Promise<void> {
    setAuthActionLoading(true);
    try {
      const response =
        mode === 'register'
          ? await api.register(email, password)
          : await api.login(email, password);
      setAuthUser(response.user);
      setAuthDialogMode(null);
      setLocalTracksByPlaylist(EMPTY_LOCAL_TRACK_MAP);
      saveLastPlaylistId(null);
      const loaded = await loadPlaylists();
      setNotice(
        loaded
          ? mode === 'register'
            ? 'Cuenta creada. Tus playlists ahora están vinculadas a ella.'
            : 'Sesión iniciada. Tus playlists se cargaron desde la nube.'
          : 'Sesión iniciada, pero no fue posible cargar las playlists. Reintenta desde la barra lateral.',
      );
    } finally {
      setAuthActionLoading(false);
    }
  }

  async function logout(): Promise<void> {
    setAuthActionLoading(true);
    try {
      await api.logout();
      setAuthUser(null);
      setLocalTracksByPlaylist(EMPTY_LOCAL_TRACK_MAP);
      saveLastPlaylistId(null);
      const loaded = await loadPlaylists();
      setNotice(
        loaded
          ? 'Sesión cerrada. Las playlists de la cuenta volverán a aparecer al iniciar sesión.'
          : 'Sesión cerrada, pero no fue posible cargar las playlists de este dispositivo.',
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.');
    } finally {
      setAuthActionLoading(false);
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 940px)');
    const updateViewport = (): void => setMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (mobileViewport) return;
    setMobileNavOpen(false);
    setQueueOpen(false);
  }, [mobileViewport]);

  const applyPlaylist = useCallback((playlist: Playlist) => {
    setActivePlaylist(playlist);
    saveLastPlaylistId(playlist.id);
    setPlaylists((current) => {
      const replacement = summaryOf(playlist);
      const found = current.some((item) => item.id === playlist.id);
      return found
        ? current.map((item) => (item.id === playlist.id ? replacement : item))
        : [replacement, ...current];
    });
    setPlaylistError(null);
  }, []);

  async function createPlaylist(name: string): Promise<void> {
    const created = await api.createPlaylist(name);
    applyPlaylist(created);
    setNameDialog(null);
  }

  async function renamePlaylist(name: string): Promise<void> {
    if (!nameDialog?.playlist) return;
    const renamed = await api.renamePlaylist(nameDialog.playlist.id, name);
    applyPlaylist(renamed);
    setNameDialog(null);
  }

  async function deletePlaylist(playlist: PlaylistSummary): Promise<void> {
    const accepted = window.confirm(`¿Eliminar la playlist «${playlist.name}» y todas sus pistas?`);
    if (!accepted) return;
    try {
      await api.deletePlaylist(playlist.id);
      setLocalTracksByPlaylist((current) => {
        if (!current[playlist.id]) return current;
        const next = { ...current };
        delete next[playlist.id];
        return next;
      });
      const remaining = playlists.filter((item) => item.id !== playlist.id);
      setPlaylists(remaining);
      if (activePlaylist?.id === playlist.id) {
        if (remaining[0]) await loadPlaylist(remaining[0].id);
        else {
          playlistLoadVersion.current += 1;
          setActivePlaylist(null);
          setPlaylistLoading(false);
          saveLastPlaylistId(null);
        }
      }
      setNotice('Playlist eliminada.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo eliminar la playlist.');
    }
  }

  async function recoverConflict(error: unknown): Promise<void> {
    if (error instanceof ApiError && error.code === 'revision_conflict' && activePlaylist) {
      await loadPlaylist(activePlaylist.id);
      await loadPlaylists(activePlaylist.id);
    }
  }

  async function addTrack(
    input: Omit<AddTrackRequest, 'expectedRevision'> & { expectedRevision: number },
  ): Promise<void> {
    if (!activePlaylist) throw new Error('Elige una playlist antes de agregar una pista.');
    try {
      const updated = await api.addTrack(activePlaylist.id, input);
      applyPlaylist(updated);
      setNotice('Pista agregada a la playlist.');
    } catch (error) {
      await recoverConflict(error);
      throw error;
    }
  }

  function addLocalFiles(files: File[]): LocalFileResult {
    const playlistId = activePlaylist?.id ?? null;
    const { tracks: selectedTracks, rejectedCount } = createLocalTracks(files, playlistId);
    if (selectedTracks.length === 0) {
      setNotice(
        'No se agregaron archivos. Elige audio compatible, como MP3, WAV, M4A, FLAC u OGG.',
      );
      return { added: 0, rejected: rejectedCount };
    }

    if (playlistId) {
      setLocalTracksByPlaylist((current) => ({
        ...current,
        [playlistId]: [...(current[playlistId] ?? EMPTY_LOCAL_TRACKS), ...selectedTracks],
      }));
    } else {
      setStandaloneLocalTracks((current) => [...current, ...selectedTracks]);
    }

    const countLabel =
      selectedTracks.length === 1 ? '1 archivo local' : `${selectedTracks.length} archivos locales`;
    const rejectedMessage = rejectedCount
      ? ` Se omitieron ${rejectedCount} archivos que no son audio compatible.`
      : '';
    const destination = activePlaylist ? `a «${activePlaylist.name}»` : 'a la cola de reproducción';
    const action =
      selectedTracks.length === 1 ? 'Se agregó temporalmente' : 'Se agregaron temporalmente';
    const availability =
      selectedTracks.length === 1
        ? 'Al ser local, el archivo solo estará disponible en este dispositivo durante esta sesión. No se sube ni se sincroniza con la nube; después de recargar o cambiar de dispositivo, deberás seleccionarlo de nuevo.'
        : 'Al ser locales, los archivos solo estarán disponibles en este dispositivo durante esta sesión. No se suben ni se sincronizan con la nube; después de recargar o cambiar de dispositivo, deberás seleccionarlos de nuevo.';
    setNotice(`${action} ${countLabel} ${destination}. ${availability}${rejectedMessage}`);
    return { added: selectedTracks.length, rejected: rejectedCount };
  }

  async function removeTrack(track: PlaybackTrack): Promise<void> {
    if (track.provider === 'local') {
      const playlistId = track.playlistId;
      if (playlistId) {
        setLocalTracksByPlaylist((current) => {
          const remaining = (current[playlistId] ?? []).filter((item) => item.id !== track.id);
          const next = { ...current };
          if (remaining.length) next[playlistId] = remaining;
          else delete next[playlistId];
          return next;
        });
        setNotice('Archivo local quitado de la playlist de esta sesión.');
      } else {
        setStandaloneLocalTracks((current) => current.filter((item) => item.id !== track.id));
        setNotice('Archivo local quitado de la cola.');
      }
      return;
    }
    if (!activePlaylist) return;
    try {
      const updated = await api.removeTrack(activePlaylist.id, track.id, activePlaylist.revision);
      applyPlaylist(updated);
      setNotice('Pista quitada de la playlist.');
    } catch (error) {
      await recoverConflict(error);
      setNotice(error instanceof Error ? error.message : 'No se pudo quitar la pista.');
    }
  }

  async function moveTrack(track: PlaybackTrack, toIndex: number): Promise<void> {
    if (track.provider === 'local') {
      const currentIndex = tracks.findIndex((item) => item.id === track.id);
      const localTracks = track.playlistId
        ? (localTracksByPlaylist[track.playlistId] ?? EMPTY_LOCAL_TRACKS)
        : standaloneLocalTracks;
      const localIndex = localTracks.findIndex((item) => item.id === track.id);
      const targetIndex = localIndex + Math.sign(toIndex - currentIndex);
      if (localIndex < 0 || targetIndex < 0 || targetIndex >= localTracks.length) return;

      const list = DoublyLinkedList.from(localTracks.map((item) => ({ id: item.id, value: item })));
      list.moveTo(track.id, targetIndex);
      const reorderedTracks = list.toArray();
      if (track.playlistId) {
        const playlistId = track.playlistId;
        setLocalTracksByPlaylist((current) => ({ ...current, [playlistId]: reorderedTracks }));
      } else {
        setStandaloneLocalTracks(reorderedTracks);
      }
      return;
    }
    if (!activePlaylist) return;
    try {
      const updated = await api.moveTrack(
        activePlaylist.id,
        track.id,
        toIndex,
        activePlaylist.revision,
      );
      applyPlaylist(updated);
    } catch (error) {
      await recoverConflict(error);
      setNotice(error instanceof Error ? error.message : 'No se pudo mover la pista.');
    }
  }

  const handleKeydown = useCallback((event: KeyboardEvent): void => {
    if (mobilePlayerExpandedRef.current && event.key === 'Escape') {
      event.preventDefault();
      setMobilePlayerExpanded(false);
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target.isContentEditable ||
      target.closest('input, textarea, select, button, [role="dialog"]') ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;

    if (event.code === 'Space') {
      event.preventDefault();
      playerRef.current.togglePlay();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      playerRef.current.previous();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      playerRef.current.next();
    } else if (event.key.toLowerCase() === 'm') {
      playerRef.current.toggleMute();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  const previousMobileExpanded = useRef(false);
  useEffect(() => {
    if (previousMobileExpanded.current === mobilePlayerExpanded) return;
    previousMobileExpanded.current = mobilePlayerExpanded;
    (mobilePlayerExpanded ? mobileCollapseButtonRef : mobileExpandButtonRef).current?.focus();
  }, [mobilePlayerExpanded]);

  useEffect(() => {
    const previous = previousMobilePanels.current;
    if (previous.nav && !mobileNavOpen) mobileNavTriggerRef.current?.focus();
    if (previous.queue && !queueOpen) queueTriggerRef.current?.focus();
    previousMobilePanels.current = { nav: mobileNavOpen, queue: queueOpen };
  }, [mobileNavOpen, queueOpen]);

  const selectedPlaylistId = activePlaylist?.id ?? null;

  return (
    <div className="app-shell">
      <PlaylistSidebar
        open={mobileNavOpen}
        mobileViewport={mobileViewport}
        playlists={playlists}
        selectedId={selectedPlaylistId}
        loading={playlistsLoading}
        error={playlistsError}
        user={authUser}
        authLoading={authLoading}
        authActionLoading={authActionLoading}
        onSelect={(id) => {
          void loadPlaylist(id);
          setMobileNavOpen(false);
        }}
        onCreate={() => setNameDialog({ mode: 'create' })}
        onRename={(playlist) => setNameDialog({ mode: 'rename', playlist })}
        onDelete={(playlist) => void deletePlaylist(playlist)}
        onRetry={() => void loadPlaylists()}
        onOpenAuth={setAuthDialogMode}
        onLogout={() => void logout()}
        onClose={() => setMobileNavOpen(false)}
      />

      {mobileNavOpen && (
        <button
          className="mobile-scrim"
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Cerrar navegación"
        />
      )}
      {queueOpen && (
        <button
          className="queue-scrim"
          type="button"
          onClick={() => setQueueOpen(false)}
          aria-label="Cerrar cola"
        />
      )}

      <div className="mobile-topbar">
        <button
          ref={mobileNavTriggerRef}
          className="icon-button"
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir playlists"
          aria-expanded={mobileNavOpen}
          aria-controls="playlist-sidebar"
        >
          <Icon name="menu" />
        </button>
        <span className="mobile-brand">
          <Icon name="brand" size={18} /> Reproductor
        </span>
        <button
          ref={queueTriggerRef}
          className="icon-button"
          type="button"
          onClick={() => setQueueOpen(true)}
          aria-label="Abrir cola"
          aria-expanded={queueOpen}
          aria-controls="queue-panel"
        >
          <Icon name="music" />
        </button>
      </div>

      <div className="workspace">
        <NowPlaying
          playlist={activePlaylist}
          tracks={tracks}
          player={player}
          playerContainerRef={playerContainerRef}
          mobileExpanded={mobilePlayerExpanded}
          loading={playlistLoading}
          error={playlistError}
          onAddTrack={() => setAddTrackOpen(true)}
          onAddLocalFiles={addLocalFiles}
          onCreatePlaylist={() => setNameDialog({ mode: 'create' })}
          onRetry={() => activePlaylist && void loadPlaylist(activePlaylist.id)}
          onCollapseMobilePlayer={() => setMobilePlayerExpanded(false)}
          mobileCollapseButtonRef={mobileCollapseButtonRef}
        />
        <QueuePanel
          playlistName={
            activePlaylist?.name ?? (standaloneLocalTracks.length > 0 ? 'Archivos locales' : null)
          }
          hasPlaylists={playlists.length > 0}
          tracks={tracks}
          currentTrackId={player.currentTrack?.id ?? null}
          unavailableIds={player.unavailableIds}
          open={queueOpen}
          mobileViewport={mobileViewport}
          onClose={() => setQueueOpen(false)}
          onAdd={() => {
            setAddTrackOpen(true);
          }}
          onAddLocalFiles={addLocalFiles}
          onCreatePlaylist={() => {
            setQueueOpen(false);
            setNameDialog({ mode: 'create' });
          }}
          onPlay={player.playTrack}
          onMove={(track, toIndex) => void moveTrack(track, toIndex)}
          onRemove={(track) => void removeTrack(track)}
        />
      </div>

      <footer className="app-footer">
        <span>Reproduce YouTube Music y archivos locales desde este dispositivo.</span>
        <a href="/privacy.html">Privacidad</a>
      </footer>

      {player.currentTrack && !mobilePlayerExpanded && (
        <div className="mobile-player" aria-label="Controles de reproducción móvil">
          <button
            ref={mobileExpandButtonRef}
            className="mobile-player-copy"
            type="button"
            aria-label={`Ampliar reproductor: ${player.currentTrack.title}`}
            onClick={() => setMobilePlayerExpanded(true)}
          >
            <span className="mobile-player-title">{player.currentTrack.title}</span>
            <span className="mobile-player-artist">
              {player.currentTrack.artist || sourceLabel(player.currentTrack.provider)}
            </span>
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Anterior"
            onClick={player.previous}
          >
            <Icon name="previous" size={20} />
          </button>
          <button
            className="play-button mobile-play"
            type="button"
            aria-label={player.isPlaying ? 'Pausar' : 'Reproducir'}
            disabled={player.isLoading}
            onClick={player.togglePlay}
          >
            <Icon name={player.isPlaying ? 'pause' : 'play'} size={20} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Siguiente"
            onClick={player.next}
          >
            <Icon name="next" size={20} />
          </button>
        </div>
      )}

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            className="icon-button compact"
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setNotice(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <PlaylistNameDialog
        open={nameDialog !== null}
        mode={nameDialog?.mode ?? 'create'}
        initialName={nameDialog?.playlist?.name ?? ''}
        onClose={() => setNameDialog(null)}
        onSubmit={nameDialog?.mode === 'rename' ? renamePlaylist : createPlaylist}
      />
      <AuthDialog
        open={authDialogMode !== null}
        mode={authDialogMode ?? 'login'}
        onClose={() => setAuthDialogMode(null)}
        onModeChange={setAuthDialogMode}
        onSubmit={submitAuth}
      />
      <AddTrackDialog
        open={addTrackOpen}
        playlist={activePlaylist}
        onClose={() => setAddTrackOpen(false)}
        onAdd={addTrack}
        onAddLocalFiles={addLocalFiles}
      />
    </div>
  );
}

export default App;

function sourceLabel(provider: PlaybackTrack['provider']): string {
  if (provider === 'youtube') return 'YouTube Music';
  if (provider === 'jamendo') return 'Jamendo';
  if (provider === 'local') return 'Archivo local';
  return 'Audio directo';
}
