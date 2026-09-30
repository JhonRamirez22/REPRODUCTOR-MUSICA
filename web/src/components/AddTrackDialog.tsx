import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AddTrackRequest, CatalogTrack, Playlist } from '@reproductor/shared';
import { api } from '../api/client.js';
import { Icon } from './Icon.js';

interface AddTrackDialogProps {
  open: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  onAdd: (
    input: Omit<AddTrackRequest, 'expectedRevision'> & { expectedRevision: number },
  ) => Promise<void>;
}

export function AddTrackDialog({ open, playlist, onClose, onAdd }: AddTrackDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [catalogEnabled, setCatalogEnabled] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogTrack[]>([]);
  const [selected, setSelected] = useState<CatalogTrack | null>(null);
  const [placement, setPlacement] = useState<'head' | 'tail' | 'index'>('tail');
  const [index, setIndex] = useState(1);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRequest = useRef(0);
  const searchRequest = useRef(0);

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
    statusRequest.current += 1;
    searchRequest.current += 1;
    if (!open) return;

    setCatalogEnabled(null);
    setQuery('');
    setResults([]);
    setSelected(null);
    setPlacement('tail');
    setIndex((playlist?.trackCount ?? 0) + 1);
    setLoadingStatus(true);
    setSearching(false);
    setSaving(false);
    setError(null);

    const requestId = statusRequest.current;
    void api
      .catalogStatus()
      .then((status) => {
        if (statusRequest.current === requestId) setCatalogEnabled(status.enabled);
      })
      .catch((statusError: unknown) => {
        if (statusRequest.current === requestId) {
          setCatalogEnabled(false);
          setError(statusError instanceof Error ? statusError.message : 'No se pudo conectar.');
        }
      })
      .finally(() => {
        if (statusRequest.current === requestId) setLoadingStatus(false);
      });
  }, [open, playlist?.id, playlist?.trackCount]);

  function close(): void {
    statusRequest.current += 1;
    searchRequest.current += 1;
    onClose();
  }

  function changeQuery(value: string): void {
    searchRequest.current += 1;
    setQuery(value);
    setResults([]);
    setSelected(null);
    setSearching(false);
    setError(null);
  }

  async function search(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const searchTerm = query.trim();
    if (searchTerm.length < 2) {
      setError('Escribe al menos dos caracteres para buscar.');
      return;
    }
    const requestId = ++searchRequest.current;
    setSearching(true);
    setResults([]);
    setSelected(null);
    setError(null);
    try {
      const response = await api.searchCatalog(searchTerm);
      if (searchRequest.current === requestId) setResults(response.tracks);
    } catch (searchError) {
      if (searchRequest.current === requestId) {
        setError(
          searchError instanceof Error
            ? searchError.message
            : 'No se pudo buscar en YouTube Music.',
        );
      }
    } finally {
      if (searchRequest.current === requestId) setSearching(false);
    }
  }

  async function submit(): Promise<void> {
    if (!playlist || !selected) {
      setError('Elige una pista del catálogo antes de agregarla.');
      return;
    }
    const at =
      placement === 'index'
        ? { mode: 'index' as const, index: Math.max(0, index - 1) }
        : { mode: placement };
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        query: query.trim(),
        videoId: selected.id,
        at,
        expectedRevision: playlist.revision,
      });
      onClose();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'No se pudo agregar la pista.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog add-track-dialog"
      aria-labelledby="add-track-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div>
        <div className="dialog-header">
          <div>
            <h2 id="add-track-title">Buscar música</h2>
            <p className="dialog-intro">Busca canciones en YouTube Music.</p>
          </div>
          <button className="icon-button" type="button" onClick={close} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>

        {loadingStatus ? (
          <p className="catalog-status" role="status">
            Conectando con el catálogo…
          </p>
        ) : catalogEnabled ? (
          <>
            <form className="catalog-search-form" onSubmit={(event) => void search(event)}>
              <label className="field-label" htmlFor="catalog-query">
                Canción o artista
              </label>
              <div className="search-entry">
                <input
                  id="catalog-query"
                  className="text-input"
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(event) => changeQuery(event.target.value)}
                  placeholder="Canción o artista"
                  autoComplete="off"
                />
                <button
                  className="button button-quiet catalog-search-button"
                  type="submit"
                  disabled={query.trim().length < 2 || searching}
                >
                  {searching ? 'Buscando…' : 'Buscar'}
                </button>
              </div>
            </form>
            <p className="field-hint" id="catalog-help">
              Los resultados se reproducen desde el reproductor oficial de YouTube.
            </p>

            {results.length > 0 && (
              <ul
                className="catalog-results"
                aria-label="Resultados de búsqueda"
                aria-live="polite"
              >
                {results.map((track) => (
                  <li className="catalog-result" key={track.id}>
                    <button
                      className="catalog-result-select"
                      type="button"
                      aria-pressed={selected?.id === track.id}
                      onClick={() => setSelected(track)}
                    >
                      {track.thumbnailUrl ? (
                        <img src={track.thumbnailUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="catalog-result-mark" aria-hidden="true">
                          <Icon name="music" size={19} />
                        </span>
                      )}
                      <span className="catalog-result-copy">
                        <strong>{track.title}</strong>
                        <span>{track.artist}</span>
                        <span className="catalog-provider">YouTube Music</span>
                      </span>
                      <span
                        className="catalog-result-duration"
                        aria-label={`Duración ${formatDuration(track.durationSec)}`}
                      >
                        {formatDuration(track.durationSec)}
                      </span>
                    </button>
                    <div className="catalog-result-links">
                      <a href={track.attributionUrl} target="_blank" rel="noreferrer">
                        Abrir en YouTube
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
              <p className="catalog-status" role="status">
                No se encontraron pistas. Prueba con otro título o artista.
              </p>
            )}

            {selected && (
              <p className="selected-track" aria-live="polite">
                Seleccionada: <strong>{selected.title}</strong> · {selected.artist}
              </p>
            )}
          </>
        ) : (
          <div className="catalog-status catalog-not-configured" role="status">
            <h3>El catálogo no está conectado</h3>
            <p>
              Instala las dependencias indicadas en <code>server/requirements.txt</code> y configura
              <code> YTMUSIC_PYTHON</code> si tu intérprete tiene otra ruta. Consulta el README.
            </p>
          </div>
        )}

        <fieldset className="placement-fieldset">
          <legend>Posición en la playlist</legend>
          <label className="select-row">
            <span>Agregar al</span>
            <select
              className="select-input"
              value={placement}
              onChange={(event) => setPlacement(event.target.value as 'head' | 'tail' | 'index')}
            >
              <option value="head">Inicio</option>
              <option value="tail">Final</option>
              <option value="index">Elegir posición</option>
            </select>
          </label>
          {placement === 'index' && (
            <label className="select-row">
              <span>Posición (1–{(playlist?.trackCount ?? 0) + 1})</span>
              <input
                className="number-input"
                type="number"
                min={1}
                max={(playlist?.trackCount ?? 0) + 1}
                value={index}
                onChange={(event) => setIndex(Number(event.target.value))}
                required
              />
            </label>
          )}
        </fieldset>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={close}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={!catalogEnabled || !selected || saving}
            onClick={() => void submit()}
          >
            {saving ? 'Agregando…' : 'Agregar a la playlist'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
