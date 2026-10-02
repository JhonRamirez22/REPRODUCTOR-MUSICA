import { afterEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, QueryResultRow } from 'pg';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

interface StoredAccount {
  id: string;
  email: string;
  password_hash: string;
}

interface StoredSession {
  tokenHash: string;
  accountId: string;
  expiresAt: Date;
}

function createAuthPool(): { pool: Pool; ownerIds: string[] } {
  const accounts: StoredAccount[] = [];
  const sessions: StoredSession[] = [];
  const ownerIds: string[] = [];

  async function execute(
    sql: string,
    values: unknown[] = [],
  ): Promise<{ rows: QueryResultRow[]; rowCount: number }> {
    if (sql.includes('INSERT INTO accounts')) {
      const email = String(values[1]);
      if (accounts.some((account) => account.email === email)) {
        throw Object.assign(new Error('duplicate'), {
          code: '23505',
          constraint: 'accounts_email_lower_idx',
        });
      }
      accounts.push({ id: String(values[0]), email, password_hash: String(values[2]) });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO auth_sessions')) {
      sessions.push({
        tokenHash: String(values[0]),
        accountId: String(values[1]),
        expiresAt: values[2] instanceof Date ? values[2] : new Date(String(values[2])),
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('FROM auth_sessions s')) {
      const session = sessions.find(
        (item) => item.tokenHash === values[0] && item.expiresAt.getTime() > Date.now(),
      );
      const account = accounts.find((item) => item.id === session?.accountId);
      return {
        rows: account ? [{ id: account.id, email: account.email }] : [],
        rowCount: account ? 1 : 0,
      };
    }
    if (sql.includes('FROM accounts WHERE lower(email)')) {
      const account = accounts.find((item) => item.email === values[0]);
      return { rows: account ? [{ ...account }] : [], rowCount: account ? 1 : 0 };
    }
    if (sql.includes('DELETE FROM auth_sessions')) {
      const index = sessions.findIndex((item) => item.tokenHash === values[0]);
      if (index >= 0) sessions.splice(index, 1);
      return { rows: [], rowCount: index >= 0 ? 1 : 0 };
    }
    if (sql.includes('FROM playlists p')) {
      ownerIds.push(String(values[0]));
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  }

  const client = {
    query: execute,
    release: () => undefined,
  };
  const pool = {
    query: execute,
    connect: async () => client,
  } as unknown as Pool;
  return { pool, ownerIds };
}

function cookieFrom(response: { headers: Record<string, unknown> }, name: string): string {
  const header = response.headers['set-cookie'];
  const entries = Array.isArray(header) ? header : [header];
  const cookie = entries.find((entry) => typeof entry === 'string' && entry.startsWith(`${name}=`));
  if (typeof cookie !== 'string') throw new Error(`Missing ${name} cookie.`);
  return cookie.slice(name.length + 1).split(';', 1)[0] ?? '';
}

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
  COOKIE_SECRET: 'test-secret-that-is-at-least-thirty-two-bytes',
});

let app: FastifyInstance | null = null;

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('account sessions', () => {
  it('keeps guest playlists when registering and loads them through the account on another device', async () => {
    const { pool, ownerIds } = createAuthPool();
    app = await buildApp({ config, pool, instance: Fastify({ logger: false }) });

    const guestPlaylists = await app.inject({ method: 'GET', url: '/api/playlists' });
    expect(guestPlaylists.statusCode).toBe(200);
    const anonymousCookie = cookieFrom(guestPlaylists, 'owner_id');
    const previousOwnerId = ownerIds[0];

    const registration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: ' Listener@Example.com ', password: 'correct-horse-battery' },
      cookies: { owner_id: anonymousCookie },
    });
    expect(registration.statusCode).toBe(201);
    expect(registration.json().user).toMatchObject({
      id: previousOwnerId,
      email: 'listener@example.com',
    });
    const sessionCookie = cookieFrom(registration, 'session_id');
    const rotatedAnonymousCookie = cookieFrom(registration, 'owner_id');
    expect(rotatedAnonymousCookie).not.toBe(anonymousCookie);
    expect(String(registration.headers['set-cookie'])).toContain('HttpOnly');

    const accountPlaylists = await app.inject({
      method: 'GET',
      url: '/api/playlists',
      cookies: { session_id: sessionCookie },
    });
    expect(accountPlaylists.statusCode).toBe(200);
    expect(ownerIds.at(-1)).toBe(previousOwnerId);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'LISTENER@example.com', password: 'correct-horse-battery' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.id).toBe(previousOwnerId);
    const secondDeviceCookie = cookieFrom(login, 'session_id');
    const secondDevicePlaylists = await app.inject({
      method: 'GET',
      url: '/api/playlists',
      cookies: { session_id: secondDeviceCookie },
    });
    expect(secondDevicePlaylists.statusCode).toBe(200);
    expect(ownerIds.at(-1)).toBe(previousOwnerId);
  });

  it('rejects duplicate registrations and invalid credentials without exposing password data', async () => {
    const { pool } = createAuthPool();
    app = await buildApp({ config, pool, instance: Fastify({ logger: false }) });
    const payload = { email: 'listener@example.com', password: 'correct-horse-battery' };

    const first = await app.inject({ method: 'POST', url: '/api/auth/register', payload });
    expect(first.statusCode).toBe(201);
    expect(first.body).not.toContain('password');

    const duplicate = await app.inject({ method: 'POST', url: '/api/auth/register', payload });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: { code: 'email_already_registered' } });

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: payload.email, password: 'incorrect-password' },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json()).toMatchObject({ error: { code: 'invalid_credentials' } });

    const weakPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'another@example.com', password: 'short' },
    });
    expect(weakPassword.statusCode).toBe(400);
  });

  it('revokes the session when logging out', async () => {
    const { pool } = createAuthPool();
    app = await buildApp({ config, pool, instance: Fastify({ logger: false }) });
    const registration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'listener@example.com', password: 'correct-horse-battery' },
    });
    const sessionCookie = cookieFrom(registration, 'session_id');

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { session_id: sessionCookie },
    });
    expect(logout.statusCode).toBe(204);

    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      cookies: { session_id: sessionCookie },
    });
    expect(session.json()).toEqual({ user: null });
  });
});
