// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogTrack, Playlist } from '@reproductor/shared';
import { api } from '../api/client.js';
import { AddTrackDialog } from './AddTrackDialog.js';

vi.mock('../api/client.js', () => ({
  api: { catalogStatus: vi.fn(), searchCatalog: vi.fn() },
}));

const playlist: Playlist = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Lista personal',
  revision: 2,
  trackCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tracks: [],
};

const catalogTrack: CatalogTrack = {
  id: 'dQw4w9WgXcQ',
  title: 'Mañana será tarde',
  artist: 'Fankel',
  durationSec: 272,
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  attributionUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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
  vi.mocked(api.catalogStatus).mockResolvedValue({ enabled: true });
  vi.mocked(api.searchCatalog).mockResolvedValue({ tracks: [catalogTrack] });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AddTrackDialog', () => {
  it('searches the catalog, selects a track, and adds it at the chosen position', async () => {
    const onAdd = vi.fn(async () => undefined);
    render(
      <AddTrackDialog
        open
        playlist={playlist}
        onClose={() => undefined}
        onAdd={onAdd}
        onAddLocalFiles={() => ({ added: 0, rejected: 0 })}
      />,
    );

    const queryInput = await screen.findByLabelText('Canción o artista');
    fireEvent.change(queryInput, { target: { value: 'Fankel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    const result = await screen.findByRole('button', { name: /Mañana será tarde/ });
    expect(api.searchCatalog).toHaveBeenCalledWith('Fankel');
    fireEvent.click(result);
    fireEvent.change(screen.getByLabelText('Agregar al'), { target: { value: 'index' } });
    fireEvent.change(screen.getByLabelText('Posición (1–3)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la playlist' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce());
    expect(onAdd).toHaveBeenCalledWith({
      query: 'Fankel',
      videoId: 'dQw4w9WgXcQ',
      at: { mode: 'index', index: 1 },
      expectedRevision: 2,
    });
    expect(screen.queryByLabelText(/enlace/i)).toBeNull();
  });

  it('ignores results from a previous search after the query changes', async () => {
    const olderSearch = deferred<{ tracks: CatalogTrack[] }>();
    const newerTrack = { ...catalogTrack, id: 'BzNzgsAE4F0', title: 'Pista nueva' };
    vi.mocked(api.searchCatalog)
      .mockReturnValueOnce(olderSearch.promise)
      .mockResolvedValueOnce({ tracks: [newerTrack] });
    const onAdd = vi.fn(async () => undefined);
    render(
      <AddTrackDialog
        open
        playlist={playlist}
        onClose={() => undefined}
        onAdd={onAdd}
        onAddLocalFiles={() => ({ added: 0, rejected: 0 })}
      />,
    );

    const queryInput = await screen.findByLabelText('Canción o artista');
    fireEvent.change(queryInput, { target: { value: 'anterior' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.change(queryInput, { target: { value: 'nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('button', { name: /Pista nueva/ });
    olderSearch.resolve({ tracks: [catalogTrack] });

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Mañana será tarde/ })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: /Pista nueva/ })).toBeTruthy();
  });

  it('explains that the catalog is unavailable without exposing setup instructions', async () => {
    vi.mocked(api.catalogStatus).mockResolvedValue({ enabled: false });
    render(
      <AddTrackDialog
        open
        playlist={playlist}
        onClose={() => undefined}
        onAdd={vi.fn()}
        onAddLocalFiles={() => ({ added: 0, rejected: 0 })}
      />,
    );

    expect(await screen.findByText('No hay conexión con el catálogo')).toBeTruthy();
    expect(screen.getByText(/avisa a quien administra esta app/i)).toBeTruthy();
    expect(screen.queryByLabelText('Canción o artista')).toBeNull();
  });

  it('rechecks an unavailable catalog when the user asks to try again', async () => {
    vi.mocked(api.catalogStatus)
      .mockResolvedValueOnce({ enabled: false })
      .mockResolvedValueOnce({ enabled: true });
    render(
      <AddTrackDialog
        open
        playlist={playlist}
        onClose={() => undefined}
        onAdd={vi.fn()}
        onAddLocalFiles={() => ({ added: 0, rejected: 0 })}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Volver a comprobar' }));
    expect(await screen.findByLabelText('Canción o artista')).toBeTruthy();
    expect(api.catalogStatus).toHaveBeenCalledTimes(2);
  });

  it('rejects positions outside the current playlist range', async () => {
    const onAdd = vi.fn(async () => undefined);
    render(
      <AddTrackDialog
        open
        playlist={playlist}
        onClose={() => undefined}
        onAdd={onAdd}
        onAddLocalFiles={() => ({ added: 0, rejected: 0 })}
      />,
    );
    const queryInput = await screen.findByLabelText('Canción o artista');
    fireEvent.change(queryInput, { target: { value: 'Fankel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.click(await screen.findByRole('button', { name: /Mañana será tarde/ }));
    fireEvent.change(screen.getByLabelText('Agregar al'), { target: { value: 'index' } });
    fireEvent.change(screen.getByLabelText('Posición (1–3)'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la playlist' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Elige una posición entre 1 y 3.',
    );
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('selects local audio without a playlist or catalog request', () => {
    const onClose = vi.fn();
    const onAddLocalFiles = vi.fn(() => ({ added: 1, rejected: 0 }));
    const file = new File(['audio'], 'Escucha.mp3', { type: 'audio/mpeg' });
    const { container } = render(
      <AddTrackDialog
        open
        playlist={null}
        onClose={onClose}
        onAdd={vi.fn()}
        onAddLocalFiles={onAddLocalFiles}
      />,
    );

    expect(screen.getByRole('button', { name: 'Elegir archivos locales de audio' })).toBeTruthy();
    expect(
      screen.getByText('Para guardar canciones de YouTube Music, primero crea una playlist.'),
    ).toBeTruthy();
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput?.multiple).toBe(true);
    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(onAddLocalFiles).toHaveBeenCalledWith([file]);
    expect(onClose).toHaveBeenCalledOnce();
    expect(api.catalogStatus).not.toHaveBeenCalled();
  });

  it('offers local files as music for the selected playlist during this session', () => {
    const onClose = vi.fn();
    const onAddLocalFiles = vi.fn(() => ({ added: 1, rejected: 0 }));
    const file = new File(['audio'], 'Escucha.mp3', { type: 'audio/mpeg' });
    const { container } = render(
      <AddTrackDialog
        open
        playlist={playlist}
        onClose={onClose}
        onAdd={vi.fn()}
        onAddLocalFiles={onAddLocalFiles}
      />,
    );

    expect(
      screen.getByText(/Se agrega al final de «Lista personal» durante esta sesión/),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Elegir archivos locales de audio' }).textContent,
    ).toContain('Agregar archivos');
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(onAddLocalFiles).toHaveBeenCalledWith([file]);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
