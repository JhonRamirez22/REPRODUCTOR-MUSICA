import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from './Icon.js';

interface PlaylistNameDialogProps {
  open: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function PlaylistNameDialog({
  open,
  mode,
  initialName = '',
  onClose,
  onSubmit,
}: PlaylistNameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initialName);
    setError(null);
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [initialName, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) {
      setError('El nombre debe tener entre 1 y 80 caracteres.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'No se pudo guardar el nombre.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="playlist-name-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="dialog-header">
          <h2 id="playlist-name-title">
            {mode === 'create' ? 'Nueva playlist' : 'Cambiar nombre'}
          </h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <label className="field-label" htmlFor="playlist-name">
          Nombre
        </label>
        <input
          id="playlist-name"
          className="text-input"
          autoFocus
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={error ? 'playlist-name-error' : undefined}
        />
        {error && (
          <p className="field-error" id="playlist-name-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : mode === 'create' ? 'Crear playlist' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
