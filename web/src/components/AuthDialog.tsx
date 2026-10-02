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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
    if (open) {
      setEmail('');
      setPassword('');
      setError(null);
    }
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
        onClose();
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
                : 'Continúa con las playlists de tu cuenta.'}
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>

        <label className="field-label" htmlFor="account-email">
          Correo electrónico
        </label>
        <input
          id="account-email"
          className="text-input"
          type="email"
          autoComplete="email"
          autoFocus
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
            ? 'Usa al menos 12 caracteres. Los archivos locales no se suben ni se sincronizan.'
            : 'Las playlists se sincronizan. Los archivos locales permanecen en este dispositivo solo durante esta sesión.'}
        </p>
        <p className="auth-policy-note">
          No hay confirmación por correo ni recuperación de contraseña automática. Usa una dirección
          que reconozcas y guarda tu contraseña.
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
            {saving ? 'Conectando…' : mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
