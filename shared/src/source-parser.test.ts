import { describe, expect, it } from 'vitest';
import { parseSourceUrl, SourceUrlError } from './source-parser.js';

const videoId = 'a1B2c3D4e5F';

describe('parseSourceUrl', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${videoId}`, videoId],
    [`https://youtu.be/${videoId}`, videoId],
    [`https://youtube.com/shorts/${videoId}`, videoId],
    [`https://music.youtube.com/watch?v=${videoId}`, videoId],
    [`https://www.youtube.com/embed/${videoId}`, videoId],
  ])('parses YouTube URL %s', (url, id) => {
    expect(parseSourceUrl(url)).toMatchObject({ provider: 'youtube', sourceId: id });
  });

  it('parses supported HTTPS audio URLs and explicit extensionless paths', () => {
    expect(parseSourceUrl('https://cdn.example.com/music/live-set.mp3')).toMatchObject({
      provider: 'audio',
      sourceId: 'https://cdn.example.com/music/live-set.mp3',
    });
    expect(parseSourceUrl('https://cdn.example.com/stream', true).provider).toBe('audio');
    expect(() => parseSourceUrl('https://cdn.example.com/stream')).toThrow(SourceUrlError);
  });

  it.each([
    'not a url',
    'javascript:alert(1)',
    'data:audio/mp3;base64,AAAA',
    'file:///tmp/audio.mp3',
    'http://cdn.example.com/song.mp3',
    'https://localhost/song.mp3',
    'https://127.0.0.1/song.mp3',
    'https://10.1.2.3/song.mp3',
    'https://192.168.1.20/song.mp3',
    'https://example.com/not-supported.pdf',
    'https://unsupported.local/song.mp3',
  ])('rejects unsafe or unsupported URL %s', (url) => {
    expect(() => parseSourceUrl(url)).toThrow(SourceUrlError);
  });

  it('rejects malformed video IDs and credential-bearing links', () => {
    expect(() => parseSourceUrl('https://youtube.com/watch?v=too-short')).toThrow('ID de video');
    expect(() => parseSourceUrl(`https://user:pass@cdn.example.com/song.mp3`)).toThrow(
      'credenciales',
    );
  });
});
