// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthDialog, type AuthMode } from './AuthDialog.js';

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

afterEach(() => cleanup());

describe('AuthDialog', () => {
  it('describes account sync and local files before registration', () => {
    render(
      <AuthDialog
        open
        mode="register"
        onClose={() => undefined}
        onModeChange={() => undefined}
        onSubmit={async () => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Crea tu cuenta' })).toBeTruthy();
    expect(screen.getByText(/otros dispositivos/i)).toBeTruthy();
    expect(screen.getByText(/archivos locales no se suben ni se sincronizan/i)).toBeTruthy();
    expect(screen.getByLabelText('Contraseña').getAttribute('minlength')).toBe('12');
  });

  it('shows a recoverable server error and exposes the login/register switch', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Ya existe una cuenta con este correo.');
    });
    const onModeChange = vi.fn<(mode: AuthMode) => void>();
    render(
      <AuthDialog
        open
        mode="register"
        onClose={() => undefined}
        onModeChange={onModeChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'listener@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'correct-horse-battery' },
    });
    const form = screen.getByRole('button', { name: 'Crear cuenta' }).closest('form');
    if (!form) throw new Error('Auth dialog form is missing.');
    fireEvent.submit(form);

    expect((await screen.findByRole('alert')).textContent).toContain('Ya existe una cuenta');
    expect(onSubmit).toHaveBeenCalledWith(
      'register',
      'listener@example.com',
      'correct-horse-battery',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inicia sesión' }));
    expect(onModeChange).toHaveBeenCalledWith('login');
    await waitFor(() => expect(onModeChange).toHaveBeenCalledOnce());
  });
});
