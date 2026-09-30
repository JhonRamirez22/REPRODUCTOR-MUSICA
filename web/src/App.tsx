import { useCallback, useEffect, useRef, useState } from 'react';
import type { AddTrackRequest, Playlist, PlaylistSummary, Track } from '@reproductor/shared';
import { AddTrackDialog } from './components/AddTrackDialog.js';
import { Icon } from './components/Icon.js';
import { NowPlaying } from './components/NowPlaying.js';
import { PlaylistNameDialog } from './components/PlaylistNameDialog.js';
import { PlaylistSidebar } from './components/PlaylistSidebar.js';
import { QueuePanel } from './components/QueuePanel.js';
import { api, ApiError } from './api/client.js';
import { usePlayer } from './player/use-player.js';
import './styles/tokens.css';
import './styles/base.css';

type NameDialogMode = 'create' | 'rename';
const EMPTY_TRACKS: readonly Track[] = [];

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
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<{
    mode: NameDialogMode;
    playlist?: PlaylistSummary;
  } | null>(null);
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobilePlayerExpanded, setMobilePlayerExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const mobileExpandButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCollapseButtonRef = useRef<HTMLButtonElement>(null);
  const playlistLoadVersion = useRef(0);
  const tracks: readonly Track[] = activePlaylist?.tracks ?? EMPTY_TRACKS;
  const player = usePlayer(tracks, playerContainerRef);
  const playerRef = useRef(player);
  const mobilePlayerExpandedRef = useRef(mobilePlayerExpanded);
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
    async (preferredId?: string): Promise<void> => {
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
      } catch (error) {
        setPlaylistsError(
          error instanceof Error ? error.message : 'No se pudieron cargar las playlists.',
        );
      } finally {
        setPlaylistsLoading(false);
      }
    },
    [loadPlaylist],
  );

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

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

  async function removeTrack(track: Track): Promise<void> {
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

  async function moveTrack(track: Track, toIndex: number): Promise<void> {
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

  const selectedPlaylistId = activePlaylist?.id ?? null;

  return (
    <div className="app-shell">
      <PlaylistSidebar
        open={mobileNavOpen}
        playlists={playlists}
        selectedId={selectedPlaylistId}
        loading={playlistsLoading}
        error={playlistsError}
        onSelect={(id) => {
          void loadPlaylist(id);
          setMobileNavOpen(false);
        }}
        onCreate={() => setNameDialog({ mode: 'create' })}
        onRename={(playlist) => setNameDialog({ mode: 'rename', playlist })}
        onDelete={(playlist) => void deletePlaylist(playlist)}
        onRetry={() => void loadPlaylists()}
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
          className="icon-button"
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir playlists"
        >
          <Icon name="menu" />
        </button>
        <span className="mobile-brand">
          <Icon name="brand" size={18} /> Reproductor
        </span>
        <button
          className="icon-button"
          type="button"
          onClick={() => setQueueOpen(true)}
          aria-label="Abrir cola"
          aria-expanded={queueOpen}
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
          onCreatePlaylist={() => setNameDialog({ mode: 'create' })}
          onRetry={() => activePlaylist && void loadPlaylist(activePlaylist.id)}
          onCollapseMobilePlayer={() => setMobilePlayerExpanded(false)}
          mobileCollapseButtonRef={mobileCollapseButtonRef}
        />
        <QueuePanel
          playlistName={activePlaylist?.name ?? null}
          tracks={tracks}
          currentTrackId={player.currentTrack?.id ?? null}
          unavailableIds={player.unavailableIds}
          open={queueOpen}
          onClose={() => setQueueOpen(false)}
          onAdd={() => {
            setQueueOpen(false);
            setAddTrackOpen(true);
          }}
          onPlay={player.playTrack}
          onMove={(track, toIndex) => void moveTrack(track, toIndex)}
          onRemove={(track) => void removeTrack(track)}
        />
      </div>

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
              {player.currentTrack.artist ||
                (player.currentTrack.provider === 'youtube' ? 'YouTube' : 'Audio directo')}
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
      <AddTrackDialog
        open={addTrackOpen}
        playlist={activePlaylist}
        onClose={() => setAddTrackOpen(false)}
        onAdd={addTrack}
      />
    </div>
  );
}

export default App;
