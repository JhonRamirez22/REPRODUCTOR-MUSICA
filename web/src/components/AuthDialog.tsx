import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from './Icon.js';

export type AuthMode = 'login' | 'register';

interface AuthDialogProps {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (mode: AuthMode, email: string, password: string) => Promise<void>;
}

export function AuthDialog({ open, mode, onClose, onModeChange, onSubmit }: AuthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let focusTimeout: number | undefined;
    if (open) {
      if (!dialogRef.current?.open) dialogRef.current?.showModal();
      focusTimeout = window.setTimeout(() => emailInputRef.current?.focus(), 0);
    }
    if (!open && dialogRef.current?.open) dialogRef.current.close();
    if (open) {
      setEmail('');
      setPassword('');
      setError(null);
    }
    return () => {
      if (focusTimeout !== undefined) window.clearTimeout(focusTimeout);
    };
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(mode, email.trim(), password);
      setEmail('');
      setPassword('');
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'No se pudo completar el acceso.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog auth-dialog"
      aria-labelledby="auth-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="dialog-header">
          <div>
            <h2 id="auth-dialog-title">
              {mode === 'register' ? 'Crea tu cuenta' : 'Inicia sesión'}
            </h2>
            <p className="dialog-intro">
              {mode === 'register'
                ? 'Las playlists de este navegador quedarán vinculadas a tu cuenta para abrirlas desde otros dispositivos.'
                : 'Inicia sesión para cargar las playlists de tu cuenta desde la nube.'}
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={saving}
          >
            <Icon name="close" />
          </button>
        </div>

        <label className="field-label" htmlFor="account-email">
          Correo electrónico
        </label>
        <input
          ref={emailInputRef}
          id="account-email"
          className="text-input"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? 'account-error' : undefined}
        />

        <label className="field-label" htmlFor="account-password">
          Contraseña
        </label>
        <input
          id="account-password"
          className="text-input"
          type="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          minLength={mode === 'register' ? 12 : undefined}
          maxLength={128}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby={error ? 'account-error' : 'account-password-hint'}
        />
        <p className="field-hint" id="account-password-hint">
          {mode === 'register'
            ? 'Usa al menos 12 caracteres y guarda tu contraseña en un lugar seguro.'
            : 'Los archivos locales no se sincronizan; vuelve a seleccionarlos en cada dispositivo.'}
        </p>
        <p className="auth-policy-note">
          {mode === 'register'
            ? 'Los archivos locales no se suben ni se vinculan a tu cuenta. No hay recuperación automática de contraseña.'
            : 'No hay recuperación automática de contraseña. Si no tienes cuenta, puedes crearla desde aquí.'}
        </p>

        {error && (
          <p className="field-error" id="account-error" role="alert">
            {error}
          </p>
        )}

        <div className="auth-switch">
          <span>{mode === 'register' ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}</span>
          <button
            className="text-button"
            type="button"
            disabled={saving}
            onClick={() => {
              setError(null);
              setPassword('');
              onModeChange(mode === 'register' ? 'login' : 'register');
            }}
          >
            {mode === 'register' ? 'Inicia sesión' : 'Crear cuenta'}
          </button>
        </div>

        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving
              ? mode === 'register'
                ? 'Creando cuenta…'
                : 'Iniciando sesión…'
              : mode === 'register'
                ? 'Crear cuenta'
                : 'Iniciar sesión'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
