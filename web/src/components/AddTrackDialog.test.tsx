// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Playlist, ResolvedTrackSource } from '@reproductor/shared';
import { api } from '../api/client.js';
import { AddTrackDialog } from './AddTrackDialog.js';

vi.mock('../api/client.js', () => ({ api: { resolve: vi.fn() } }));

const playlist: Playlist = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Lista personal',
  revision: 2,
  trackCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tracks: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

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

afterEach(cleanup);

describe('AddTrackDialog', () => {
  it('previews a user link, edits its title, and adds at the chosen position', async () => {
    vi.mocked(api.resolve).mockResolvedValue({
      provider: 'audio',
      sourceId: 'https://cdn.example.org/session.mp3',
      sourceUrl: 'https://cdn.example.org/session.mp3',
      title: 'Sesión externa',
    });
    const onAdd = vi.fn(async () => undefined);
    render(<AddTrackDialog open playlist={playlist} onClose={() => undefined} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('Enlace de YouTube o audio directo'), {
      target: { value: 'https://cdn.example.org/session.mp3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));
    await screen.findByLabelText('Título');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Sesión editada' } });
    fireEvent.change(screen.getByLabelText('Agregar al'), { target: { value: 'index' } });
    fireEvent.change(screen.getByLabelText('Posición (1–3)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la playlist' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sesión editada',
        expectedRevision: 2,
        at: { mode: 'index', index: 1 },
      }),
    );
  });

  it('ignores a preview response after the source URL changes', async () => {
    const oldUrl = 'https://cdn.example.org/old-track.mp3';
    const newUrl = 'https://cdn.example.org/new-track.mp3';
    const oldPreview = deferred<ResolvedTrackSource>();
    const freshPreview: ResolvedTrackSource = {
      provider: 'audio',
      sourceId: newUrl,
      sourceUrl: newUrl,
      title: 'Pista nueva',
    };
    vi.mocked(api.resolve)
      .mockReturnValueOnce(oldPreview.promise)
      .mockResolvedValueOnce(freshPreview);
    const onAdd = vi.fn(async () => undefined);
    render(<AddTrackDialog open playlist={playlist} onClose={() => undefined} onAdd={onAdd} />);

    const urlInput = screen.getByLabelText('Enlace de YouTube o audio directo');
    fireEvent.change(urlInput, { target: { value: oldUrl } });
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));
    fireEvent.change(urlInput, { target: { value: newUrl } });
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));

    await waitFor(() =>
      expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Pista nueva'),
    );
    oldPreview.resolve({
      provider: 'audio',
      sourceId: oldUrl,
      sourceUrl: oldUrl,
      title: 'Pista anterior',
    });

    await waitFor(() =>
      expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Pista nueva'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la playlist' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce());
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ url: newUrl, resolved: freshPreview }),
    );
  });
});
