import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AddTrackRequest, Playlist, ResolvedTrackSource } from '@reproductor/shared';
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
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [allowExtensionless, setAllowExtensionless] = useState(false);
  const [placement, setPlacement] = useState<'head' | 'tail' | 'index'>('tail');
  const [index, setIndex] = useState(1);
  const [resolved, setResolved] = useState<ResolvedTrackSource | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setUrl('');
    setTitle('');
    setArtist('');
    setAllowExtensionless(false);
    setPlacement('tail');
    setIndex((playlist?.trackCount ?? 0) + 1);
    setResolved(null);
    setError(null);
  }, [open, playlist?.id, playlist?.trackCount]);

  async function preview(): Promise<void> {
    setLoadingPreview(true);
    setResolved(null);
    setError(null);
    try {
      const result = await api.resolve(url, allowExtensionless);
      setResolved(result);
      setTitle(result.title);
      setArtist(result.artist ?? '');
    } catch (previewError) {
      setError(
        previewError instanceof Error ? previewError.message : 'No se pudo revisar el enlace.',
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!playlist || !resolved) {
      setError('Revisa el enlace antes de agregar la pista.');
      return;
    }
    if (!title.trim()) {
      setError('Escribe un título para la pista.');
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
        url,
        title: title.trim(),
        ...(artist.trim() ? { artist: artist.trim() } : {}),
        allowExtensionless,
        resolved,
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
        onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="dialog-header">
          <div>
            <h2 id="add-track-title">Agregar una pista</h2>
            <p className="dialog-intro">La música se reproduce desde su fuente original.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>

        <label className="field-label" htmlFor="track-url">
          Enlace de YouTube o audio directo
        </label>
        <div className="url-entry">
          <input
            id="track-url"
            className="text-input"
            type="url"
            autoFocus
            required
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setResolved(null);
            }}
            placeholder="Pega aquí el enlace"
            aria-describedby="source-help"
          />
          <button
            className="button button-quiet preview-button"
            type="button"
            disabled={!url.trim() || loadingPreview}
            onClick={() => void preview()}
          >
            {loadingPreview ? 'Revisando…' : 'Vista previa'}
          </button>
        </div>
        <p className="field-hint" id="source-help">
          Usa un enlace HTTPS a un archivo compatible si agregas audio directo.
        </p>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={allowExtensionless}
            onChange={(event) => {
              setAllowExtensionless(event.target.checked);
              setResolved(null);
            }}
          />
          <span>El enlace de audio no tiene extensión de archivo</span>
        </label>

        {resolved && (
          <div className="track-preview" aria-live="polite">
            {resolved.thumbnailUrl ? (
              <img src={resolved.thumbnailUrl} alt="" loading="lazy" />
            ) : (
              <div className="preview-mark" aria-hidden="true">
                <Icon name="music" size={22} />
              </div>
            )}
            <div className="track-preview-fields">
              <label className="field-label" htmlFor="track-title">
                Título
              </label>
              <input
                id="track-title"
                className="text-input"
                value={title}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
              <label className="field-label" htmlFor="track-artist">
                Artista
              </label>
              <input
                id="track-artist"
                className="text-input"
                value={artist}
                maxLength={200}
                onChange={(event) => setArtist(event.target.value)}
              />
            </div>
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
          <button className="button button-quiet" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" type="submit" disabled={!resolved || saving}>
            {saving ? 'Agregando…' : 'Agregar a la playlist'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
