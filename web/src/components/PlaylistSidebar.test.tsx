// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlaylistSidebar } from './PlaylistSidebar.js';

afterEach(() => cleanup());

function renderSidebar(user: { id: string; email: string } | null = null): void {
  render(
    <PlaylistSidebar
      open={false}
      mobileViewport={false}
      playlists={[]}
      selectedId={null}
      loading={false}
      error={null}
      user={user}
      authLoading={false}
      authActionLoading={false}
      onSelect={() => undefined}
      onCreate={() => undefined}
      onRename={() => undefined}
      onDelete={() => undefined}
      onRetry={() => undefined}
      onOpenAuth={() => undefined}
      onLogout={() => undefined}
      onClose={() => undefined}
    />,
  );
}

describe('PlaylistSidebar account section', () => {
  it('offers account creation and login with a clear cloud-sync explanation', () => {
    renderSidebar();

    expect(screen.getByRole('heading', { name: 'Sincroniza tus playlists' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(screen.getByText(/guardar.*nube/i)).toBeTruthy();
  });

  it('shows the signed-in account and cloud sync status', () => {
    renderSidebar({ id: '51d9cbad-0000-4000-a000-000000000001', email: 'listener@example.com' });

    expect(screen.getByRole('heading', { name: 'Tu cuenta' })).toBeTruthy();
    expect(screen.getByText('listener@example.com')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('sincronizadas en la nube');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });
});
