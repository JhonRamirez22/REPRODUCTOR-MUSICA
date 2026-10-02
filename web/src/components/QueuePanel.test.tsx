// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '@reproductor/shared';
import { QueuePanel } from './QueuePanel.js';

const track: Track = {
  id: '00000000-0000-4000-8000-000000000002',
  playlistId: '00000000-0000-4000-8000-000000000001',
  position: 0,
  provider: 'audio',
  sourceId: 'https://cdn.example.org/track.mp3',
  sourceUrl: 'https://cdn.example.org/track.mp3',
  title: 'Pista externa',
  artist: 'Artista externo',
  durationSec: 94,
  thumbnailUrl: null,
  attributionUrl: null,
  licenseUrl: null,
  available: true,
};
const otherTrack: Track = {
  ...track,
  id: '00000000-0000-4000-8000-000000000003',
  title: 'Otra pista',
  position: 0,
};

afterEach(cleanup);

describe('QueuePanel', () => {
  it('credits each Jamendo track and links to its source page', () => {
    const jamendoTrack: Track = {
      ...track,
      provider: 'jamendo',
      sourceId: '1848357',
      sourceUrl: 'https://www.jamendo.com/track/1848357',
      attributionUrl: 'https://www.jamendo.com/track/1848357',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    };
    render(
      <QueuePanel
        playlistName="Lista personal"
        hasPlaylists
        tracks={[jamendoTrack]}
        currentTrackId={jamendoTrack.id}
        unavailableIds={new Set()}
        open={false}
        mobileViewport={false}
        onClose={() => undefined}
        onAdd={() => undefined}
        onAddLocalFiles={() => undefined}
        onCreatePlaylist={() => undefined}
        onPlay={() => undefined}
        onMove={() => undefined}
        onRemove={() => undefined}
      />,
    );

    const attributionLink = screen.getByRole('link', {
      name: /Abrir la ficha de Pista externa en Jamendo/,
    });
    expect(attributionLink.getAttribute('href')).toBe('https://www.jamendo.com/track/1848357');
  });

  it('renders the queue and exposes accessible play, move, and remove actions', () => {
    const onPlay = vi.fn();
    const onMove = vi.fn();
    const onRemove = vi.fn();
    render(
      <QueuePanel
        playlistName="Lista personal"
        hasPlaylists
        tracks={[otherTrack, track]}
        currentTrackId={track.id}
        unavailableIds={new Set()}
        open={false}
        mobileViewport={false}
        onClose={() => undefined}
        onAdd={() => undefined}
        onAddLocalFiles={() => undefined}
        onCreatePlaylist={() => undefined}
        onPlay={onPlay}
        onMove={onMove}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText('Pista externa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir Pista externa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir Pista externa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Pista externa' }));
    expect(onPlay).toHaveBeenCalledWith(track.id);
    expect(onMove).toHaveBeenCalledWith(track, 0);
    expect(onRemove).toHaveBeenCalledWith(track);
  });

  it('hides a closed mobile queue and traps focus while it is open', () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <QueuePanel
        playlistName="Lista personal"
        hasPlaylists
        tracks={[track]}
        currentTrackId={track.id}
        unavailableIds={new Set()}
        open={false}
        mobileViewport
        onClose={onClose}
        onAdd={() => undefined}
        onAddLocalFiles={() => undefined}
        onCreatePlaylist={() => undefined}
        onPlay={() => undefined}
        onMove={() => undefined}
        onRemove={() => undefined}
      />,
    );

    const panel = container.querySelector('#queue-panel');
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
    expect(panel?.hasAttribute('inert')).toBe(true);

    rerender(
      <QueuePanel
        playlistName="Lista personal"
        hasPlaylists
        tracks={[track]}
        currentTrackId={track.id}
        unavailableIds={new Set()}
        open
        mobileViewport
        onClose={onClose}
        onAdd={() => undefined}
        onAddLocalFiles={() => undefined}
        onCreatePlaylist={() => undefined}
        onPlay={() => undefined}
        onMove={() => undefined}
        onRemove={() => undefined}
      />,
    );

    const closeButton = screen.getByRole('button', { name: 'Cerrar cola' });
    const localFilesButton = screen.getByRole('button', {
      name: 'Elegir archivos locales de audio',
    });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(localFilesButton);
    fireEvent.keyDown(localFilesButton, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(closeButton, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers playlist creation when the library is empty', () => {
    const onCreatePlaylist = vi.fn();
    render(
      <QueuePanel
        playlistName={null}
        hasPlaylists={false}
        tracks={[]}
        currentTrackId={null}
        unavailableIds={new Set()}
        open={false}
        mobileViewport={false}
        onClose={() => undefined}
        onAdd={() => undefined}
        onAddLocalFiles={() => undefined}
        onCreatePlaylist={onCreatePlaylist}
        onPlay={() => undefined}
        onMove={() => undefined}
        onRemove={() => undefined}
      />,
    );

    expect(screen.getByText('Crea una playlist para empezar tu cola.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crear playlist' }));
    expect(onCreatePlaylist).toHaveBeenCalledOnce();
    expect(screen.queryByText('Elige una playlist para ver su cola.')).toBeNull();
  });
});
