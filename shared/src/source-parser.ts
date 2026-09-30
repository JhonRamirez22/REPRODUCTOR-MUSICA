export type SourceProvider = 'youtube' | 'audio';

export interface ParsedSource {
  provider: SourceProvider;
  sourceId: string;
  sourceUrl: string;
}

export type SourceErrorCode =
  'invalid_url' | 'unsupported_host' | 'unsupported_scheme' | 'invalid_source';

export class SourceUrlError extends Error {
  constructor(
    public readonly code: SourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SourceUrlError';
  }
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const AUDIO_EXTENSIONS = /\.(?:mp3|ogg|oga|wav|m4a|aac|flac|opus)$/i;

export function parseSourceUrl(input: string, allowExtensionless = false): ParsedSource {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new SourceUrlError('invalid_url', 'Pega un enlace completo y válido.');
  }

  if (url.username || url.password) {
    throw new SourceUrlError('invalid_url', 'El enlace no puede incluir credenciales.');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const youtubeHosts = new Set([
    'youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
    'youtube-nocookie.com',
  ]);
  if (youtubeHosts.has(host)) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new SourceUrlError(
        'unsupported_scheme',
        'Los enlaces de YouTube deben usar HTTP o HTTPS.',
      );
    }
    const sourceId = youtubeId(url, host);
    if (!sourceId || !YOUTUBE_ID.test(sourceId)) {
      throw new SourceUrlError(
        'invalid_source',
        'No se encontró un ID de video de YouTube válido.',
      );
    }
    return {
      provider: 'youtube',
      sourceId,
      sourceUrl: `https://www.youtube.com/watch?v=${sourceId}`,
    };
  }

  if (url.protocol !== 'https:') {
    throw new SourceUrlError('unsupported_scheme', 'Los enlaces de audio deben usar HTTPS.');
  }
  if (isPrivateOrLocalHost(host)) {
    throw new SourceUrlError('unsupported_host', 'No se permiten direcciones locales o privadas.');
  }
  if (!AUDIO_EXTENSIONS.test(url.pathname) && !allowExtensionless) {
    throw new SourceUrlError(
      'invalid_source',
      'El enlace debe apuntar a un archivo de audio compatible.',
    );
  }
  if (!url.hostname || (url.hostname.indexOf('.') < 0 && !isIpLiteral(host))) {
    throw new SourceUrlError('unsupported_host', 'El enlace debe usar un dominio público.');
  }

  url.hash = '';
  return { provider: 'audio', sourceId: url.toString(), sourceUrl: url.toString() };
}

function youtubeId(url: URL, host: string): string | null {
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] ?? null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.pathname === '/watch' || url.pathname === '/') return url.searchParams.get('v');
  if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') return parts[1] ?? null;
  return null;
}

function isIpLiteral(host: string): boolean {
  return host.includes(':') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isPrivateOrLocalHost(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/i.test(normalized) ||
    normalized.startsWith('::ffff:')
  ) {
    return true;
  }

  const octets = normalized.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}
