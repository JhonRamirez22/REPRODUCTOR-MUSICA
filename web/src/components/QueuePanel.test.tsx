// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  available: true,
};
const otherTrack: Track = {
  ...track,
  id: '00000000-0000-4000-8000-000000000003',
  title: 'Otra pista',
  position: 0,
};

describe('QueuePanel', () => {
  it('renders the queue and exposes accessible play, move, and remove actions', () => {
    const onPlay = vi.fn();
    const onMove = vi.fn();
    const onRemove = vi.fn();
    render(
      <QueuePanel
        playlistName="Lista personal"
        tracks={[otherTrack, track]}
        currentTrackId={track.id}
        unavailableIds={new Set()}
        open={false}
        onClose={() => undefined}
        onAdd={() => undefined}
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
});
