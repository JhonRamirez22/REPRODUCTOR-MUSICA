// @vitest-environment jsdom
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Track } from '@reproductor/shared';
import { usePlayer } from '../player/use-player.js';
import { NowPlaying } from './NowPlaying.js';

afterEach(cleanup);

describe('NowPlaying', () => {
  it('keeps next enabled when the current track is unavailable', async () => {
    const track: Track = {
      id: '00000000-0000-4000-8000-000000000025',
      playlistId: '00000000-0000-4000-8000-000000000001',
      position: 0,
      provider: 'youtube',
      sourceId: 'abcdefghijk',
      sourceUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      title: 'Pista no disponible',
      artist: null,
      durationSec: 120,
      thumbnailUrl: null,
      attributionUrl: null,
      licenseUrl: null,
      available: false,
    };
    const tracks = [track];
    const { result } = renderHookForPlayer(tracks);
    await waitFor(() => expect(result.current.currentTrack?.id).toBe(track.id));

    render(
      <NowPlaying
        playlist={null}
        tracks={[track]}
        player={{ ...result.current, unavailableIds: new Set([track.id]) }}
        playerContainerRef={{ current: null }}
        mobileExpanded={false}
        loading={false}
        error={null}
        onAddTrack={() => undefined}
        onAddLocalFiles={() => undefined}
        onCreatePlaylist={() => undefined}
        onRetry={() => undefined}
        onCollapseMobilePlayer={() => undefined}
        mobileCollapseButtonRef={{ current: null }}
      />,
    );

    expect((screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole('button', { name: 'Reproducir' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

function renderHookForPlayer(tracks: readonly Track[]) {
  // Keep the player state real so this checks the same props passed by the app.
  return renderHook(() => usePlayer(tracks));
}
