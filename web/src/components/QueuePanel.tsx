import { useEffect, useRef, useState } from 'react';
import { Reorder, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { isLocalTrack, type PlaybackTrack } from '../player/local-track.js';
import { Icon } from './Icon.js';
import { formatTime } from './PlayerControls.js';
import { focusMobilePanel, trapMobilePanelFocus } from './mobile-panel.js';
import { LocalFilesButton } from './LocalFilesButton.js';

interface QueuePanelProps {
  playlistName: string | null;
  hasPlaylists: boolean;
  tracks: readonly PlaybackTrack[];
  currentTrackId: string | null;
  unavailableIds: ReadonlySet<string>;
  open: boolean;
  mobileViewport: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: () => void;
  onAddLocalFiles: (files: File[]) => void;
  onCreatePlaylist: () => void;
  onPlay: (id: string) => void;
  onMove: (track: PlaybackTrack, toIndex: number) => void;
  onRemove: (track: PlaybackTrack) => void;
}

export function QueuePanel({
  playlistName,
  hasPlaylists,
  tracks,
  currentTrackId,
  unavailableIds,
  open,
  mobileViewport,
  onOpen,
  onClose,
  onAdd,
  onAddLocalFiles,
  onCreatePlaylist,
  onPlay,
  onMove,
  onRemove,
}: QueuePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelDragControls = useDragControls();
  const orderRef = useRef<readonly PlaybackTrack[]>(tracks);
  const draggedIdRef = useRef<string | null>(null);
  const [orderedTracks, setOrderedTracks] = useState<readonly PlaybackTrack[]>(tracks);
  const shouldReduceMotion = useReducedMotion();
  const localTracks = tracks.filter(isLocalTrack);
  const playlistTracks = tracks.filter((track) => !isLocalTrack(track));

  useEffect(() => {
    orderRef.current = tracks;
    setOrderedTracks(tracks);
  }, [tracks]);

  function handleReorder(nextTracks: PlaybackTrack[]): void {
    orderRef.current = nextTracks;
    setOrderedTracks(nextTracks);
  }

  function finishReorder(trackId: string): void {
    if (draggedIdRef.current !== trackId) return;
    const draggedTrack = tracks.find((track) => track.id === trackId);
    if (!draggedTrack) return;
    const isLocal = isLocalTrack(draggedTrack);
    const before = tracks.filter((track) => isLocalTrack(track) === isLocal);
    const after = orderRef.current.filter((track) => isLocalTrack(track) === isLocal);
    const fromIndex = before.findIndex((track) => track.id === trackId);
    const toIndex = after.findIndex((track) => track.id === trackId);
    draggedIdRef.current = null;
    orderRef.current = tracks;
    setOrderedTracks(tracks);
    if (toIndex >= 0 && toIndex !== fromIndex) onMove(draggedTrack, toIndex);
  }

  useEffect(() => {
    if (open && mobileViewport && panelRef.current) focusMobilePanel(panelRef.current);
  }, [mobileViewport, open]);

  return (
    <>
      {mobileViewport && !open && (
        <motion.button
          className="queue-peek"
          type="button"
          drag="y"
          dragConstraints={{ top: -360, bottom: 0 }}
          dragMomentum={false}
          onClick={onOpen}
          onDragEnd={(_event, info) => {
            if (info.offset.y < -52 || info.velocity.y < -320) onOpen();
          }}
          aria-controls="queue-panel"
          aria-label="Arrastra hacia arriba o activa para abrir la cola"
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          <span className="queue-peek-grip" aria-hidden="true" />
          <span>Cola de reproducción</span>
          <span className="queue-peek-count">{tracks.length}</span>
          <Icon name="up" size={16} />
        </motion.button>
      )}
      <motion.aside
        ref={panelRef}
        id="queue-panel"
        className={`queue-panel${open ? ' is-open' : ''}`}
        initial={false}
        animate={
          mobileViewport
            ? { y: open ? 0 : 'calc(100% + 24px)', opacity: open ? 1 : 0 }
            : { y: 0, opacity: 1 }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0.15, ease: [0.22, 1, 0.36, 1] }
            : { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }
        }
        drag={mobileViewport && open ? 'y' : false}
        dragListener={false}
        dragControls={panelDragControls}
        dragConstraints={{ top: 0, bottom: 400 }}
        dragMomentum={false}
        onDragEnd={(_event, info) => {
          if (info.offset.y > 110 || info.velocity.y > 520) onClose();
        }}
        style={{ pointerEvents: mobileViewport && !open ? 'none' : 'auto' }}
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
              {playlistName ?? (hasPlaylists ? 'Elige una playlist' : 'Sin playlists')}
              {playlistName
                ? ` · ${tracks.length} ${tracks.length === 1 ? 'pista' : 'pistas'}`
                : ''}
            </p>
          </div>
          {mobileViewport && open && (
            <div
              className="queue-sheet-handle"
              aria-hidden="true"
              onPointerDown={(event) => panelDragControls.start(event)}
            >
              <span />
            </div>
          )}
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
            {hasPlaylists ? (
              <p>Elige una playlist para ver su cola.</p>
            ) : (
              <>
                <p>Crea una playlist para empezar tu cola.</p>
                <button className="text-button" type="button" onClick={onCreatePlaylist}>
                  Crear playlist
                </button>
              </>
            )}
            <LocalFilesButton onSelectFiles={onAddLocalFiles} />
          </div>
        ) : tracks.length === 0 ? (
          <div className="queue-empty">
            <p>Las pistas que agregues aparecerán aquí.</p>
            <button className="text-button" type="button" onClick={onAdd}>
              Agregar una pista
            </button>
            <LocalFilesButton onSelectFiles={onAddLocalFiles} />
          </div>
        ) : (
          <Reorder.Group
            as="ol"
            axis="y"
            className="queue-list"
            aria-label={`Pistas de ${playlistName}`}
            values={[...orderedTracks]}
            onReorder={handleReorder}
          >
            {orderedTracks.map((track, position) => {
              const current = track.id === currentTrackId;
              const unavailable = unavailableIds.has(track.id);
              const local = isLocalTrack(track);
              const groupTracks = local ? localTracks : playlistTracks;
              const groupPosition = groupTracks.findIndex((item) => item.id === track.id);
              return (
                <QueueItem
                  key={track.id}
                  track={track}
                  position={position}
                  groupPosition={groupPosition}
                  groupLength={groupTracks.length}
                  current={current}
                  unavailable={unavailable}
                  onPlay={onPlay}
                  onMove={onMove}
                  onRemove={onRemove}
                  onDragStart={() => {
                    draggedIdRef.current = track.id;
                  }}
                  onDragEnd={() => finishReorder(track.id)}
                />
              );
            })}
          </Reorder.Group>
        )}

        {playlistName && tracks.length > 0 && (
          <div className="queue-add-actions">
            <button className="queue-add-button" type="button" onClick={onAdd}>
              <Icon name="plus" size={17} /> Agregar una pista
            </button>
            <LocalFilesButton onSelectFiles={onAddLocalFiles} />
          </div>
        )}
      </motion.aside>
    </>
  );
}

interface QueueItemProps {
  track: PlaybackTrack;
  position: number;
  groupPosition: number;
  groupLength: number;
  current: boolean;
  unavailable: boolean;
  onPlay: (id: string) => void;
  onMove: (track: PlaybackTrack, toIndex: number) => void;
  onRemove: (track: PlaybackTrack) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function QueueItem({
  track,
  position,
  groupPosition,
  groupLength,
  current,
  unavailable,
  onPlay,
  onMove,
  onRemove,
  onDragStart,
  onDragEnd,
}: QueueItemProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      as="li"
      className={`queue-item${current ? ' is-current' : ''}${unavailable ? ' is-unavailable' : ''}`}
      value={track}
      aria-current={current ? 'true' : undefined}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <button
        className="queue-drag-handle"
        type="button"
        aria-label={`Arrastrar para reordenar ${track.title}`}
        onPointerDown={(event) => dragControls.start(event)}
        title="Arrastra para reordenar"
      >
        <Icon name="grip" size={16} />
      </button>
      <span className="queue-position tw:tabular-nums" aria-label={`Posición ${position + 1}`}>
        {String(position + 1).padStart(2, '0')}
      </span>
      <span className="queue-cover" aria-hidden="true">
        {track.thumbnailUrl ? (
          <img
            src={track.thumbnailUrl}
            alt=""
            width={42}
            height={42}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="queue-cover-fallback" />
        )}
        {current && (
          <span className="queue-equalizer">
            <span />
            <span />
            <span />
          </span>
        )}
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
          disabled={groupPosition === 0}
          onClick={() => onMove(track, groupPosition - 1)}
        >
          <Icon name="up" size={16} />
        </button>
        <button
          className="icon-button compact"
          type="button"
          aria-label={`Bajar ${track.title}`}
          disabled={groupPosition === groupLength - 1}
          onClick={() => onMove(track, groupPosition + 1)}
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
    </Reorder.Item>
  );
}

function providerLabel(provider: PlaybackTrack['provider']): string {
  if (provider === 'youtube') return 'YouTube Music';
  if (provider === 'jamendo') return 'Jamendo';
  if (provider === 'local') return 'Archivo local';
  return 'Audio directo';
}
