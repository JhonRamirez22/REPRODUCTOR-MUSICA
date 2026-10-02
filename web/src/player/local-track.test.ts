// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createLocalTracks, isSupportedAudioFile } from './local-track.js';

describe('local audio files', () => {
  it('accepts audio MIME types and supported extensions, and skips other files', () => {
    const mp3 = new File(['audio'], 'Canción.MP3', { type: 'application/octet-stream' });
    const m4a = new File(['audio'], 'Nota de voz.m4a', { type: 'audio/mp4' });
    const document = new File(['text'], 'notas.txt', { type: 'text/plain' });

    expect(isSupportedAudioFile(mp3)).toBe(true);
    expect(isSupportedAudioFile(m4a)).toBe(true);
    expect(isSupportedAudioFile(document)).toBe(false);

    const selection = createLocalTracks([mp3, m4a, document], 'playlist-local');
    expect(selection.tracks.map((track) => track.title)).toEqual(['Canción', 'Nota de voz']);
    expect(selection.tracks.map((track) => track.file)).toEqual([mp3, m4a]);
    expect(selection.tracks.every((track) => track.provider === 'local')).toBe(true);
    expect(selection.tracks.every((track) => track.playlistId === 'playlist-local')).toBe(true);
    expect(selection.rejectedCount).toBe(1);
  });
});
