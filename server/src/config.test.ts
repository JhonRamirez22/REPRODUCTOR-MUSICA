import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const requiredEnvironment = {
  DATABASE_URL: 'postgres://reproductor:password@localhost:5432/reproductor',
  COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
};

describe('loadConfig', () => {
  it('requires the remote catalog URL and token as a pair', () => {
    expect(() =>
      loadConfig({ ...requiredEnvironment, YTMUSIC_API_URL: 'https://catalog.example.com/api' }),
    ).toThrow('YTMUSIC_API_URL and YTMUSIC_API_TOKEN must be configured together.');
    expect(() => loadConfig({ ...requiredEnvironment, YTMUSIC_API_TOKEN: 'a'.repeat(32) })).toThrow(
      'YTMUSIC_API_URL and YTMUSIC_API_TOKEN must be configured together.',
    );
  });

  it('accepts an HTTPS catalog endpoint with a sufficiently long token', () => {
    expect(
      loadConfig({
        ...requiredEnvironment,
        YTMUSIC_API_URL: 'https://catalog.example.com/api',
        YTMUSIC_API_TOKEN: 'a'.repeat(32),
      }),
    ).toMatchObject({
      YTMUSIC_API_URL: 'https://catalog.example.com/api',
      YTMUSIC_API_TOKEN: 'a'.repeat(32),
    });
  });

  it('rejects an insecure remote catalog endpoint', () => {
    expect(() =>
      loadConfig({
        ...requiredEnvironment,
        YTMUSIC_API_URL: 'http://catalog.example.com/api',
        YTMUSIC_API_TOKEN: 'a'.repeat(32),
      }),
    ).toThrow('must use HTTPS');
  });
});
