import type { Track } from '@reproductor/shared';

export interface LocalTrack {
  id: string;
  title: string;
  artist: null;
  durationSec: null;
  thumbnailUrl: null;
  provider: 'local';
  playlistId: string | null;
  file: File;
}

export interface LocalFileSelection {
  tracks: LocalTrack[];
  rejectedCount: number;
}

export type PlaybackTrack = Track | LocalTrack;

const SUPPORTED_AUDIO_EXTENSIONS = /\.(?:mp3|ogg|oga|wav|m4a|aac|flac|opus)$/i;

export function isLocalTrack(track: PlaybackTrack): track is LocalTrack {
  return track.provider === 'local';
}

export function isSupportedAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || SUPPORTED_AUDIO_EXTENSIONS.test(file.name);
}

export function createLocalTracks(
  files: readonly File[],
  playlistId: string | null = null,
): LocalFileSelection {
  const tracks: LocalTrack[] = [];
  let rejectedCount = 0;

  for (const file of files) {
    if (!isSupportedAudioFile(file)) {
      rejectedCount += 1;
      continue;
    }

    const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Archivo de audio';
    tracks.push({
      id: crypto.randomUUID(),
      title,
      artist: null,
      durationSec: null,
      thumbnailUrl: null,
      provider: 'local',
      playlistId,
      file,
    });
  }

  return { tracks, rejectedCount };
}
