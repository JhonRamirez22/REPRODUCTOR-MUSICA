import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { AuthCredentials, AuthUser } from '@reproductor/shared';
import { HttpError } from '../errors.js';
import {
  anonymousOwnerIdForRequest,
  existingAnonymousOwnerId,
  rotateAnonymousOwnerCookie,
} from '../owner.js';

const SESSION_COOKIE = 'session_id';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_KEY_BYTES = 64;
const SCRYPT_COST = 16_384;
const DUMMY_PASSWORD_HASH = `scrypt$${SCRYPT_COST}$8$1$${Buffer.from('0123456789abcdef').toString('base64url')}$${Buffer.alloc(PASSWORD_KEY_BYTES).toString('base64url')}`;

interface AccountRow extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
}

interface SessionRow extends QueryResultRow {
  id: string;
  email: string;
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      PASSWORD_KEY_BYTES,
      { N: SCRYPT_COST, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${SCRYPT_COST}$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, encodedSalt, encodedKey] = encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    cost !== String(SCRYPT_COST) ||
    blockSize !== '8' ||
    parallelization !== '1' ||
    !encodedSalt ||
    !encodedKey
  )
    return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(encodedSalt, 'base64url');
    expected = Buffer.from(encodedKey, 'base64url');
  } catch {
    return false;
  }
  if (salt.length !== 16 || expected.length !== PASSWORD_KEY_BYTES) return false;
  const actual = await derivePasswordKey(password, salt);
  return timingSafeEqual(actual, expected);
}

function sessionDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sessionTokenFromRequest(request: FastifyRequest): string | null {
  const cookie = request.cookies[SESSION_COOKIE];
  if (!cookie) return null;
  const result = request.unsignCookie(cookie);
  return result.valid && result.value ? result.value : null;
}

function setSessionCookie(reply: FastifyReply, token: string, secureCookie: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

function clearSessionCookie(reply: FastifyReply, secureCookie: boolean): void {
  reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    path: '/',
  });
}

export class AuthService {
  constructor(private readonly pool: Pool) {}

  async sessionUser(
    request: FastifyRequest,
    reply: FastifyReply,
    secureCookie: boolean,
  ): Promise<AuthUser | null> {
    const token = sessionTokenFromRequest(request);
    if (!token) {
      if (request.cookies[SESSION_COOKIE]) clearSessionCookie(reply, secureCookie);
      return null;
    }
    const result = await this.pool.query<SessionRow>(
      `SELECT a.id, a.email
         FROM auth_sessions s
         JOIN accounts a ON a.id = s.account_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sessionDigest(token)],
    );
    const row = result.rows[0];
    if (!row) {
      clearSessionCookie(reply, secureCookie);
      return null;
    }
    return { id: row.id, email: row.email };
  }

  async ownerIdForRequest(
    request: FastifyRequest,
    reply: FastifyReply,
    secureCookie: boolean,
  ): Promise<string> {
    const user = await this.sessionUser(request, reply, secureCookie);
    return user?.id ?? anonymousOwnerIdForRequest(request, reply, secureCookie);
  }

  async register(
    request: FastifyRequest,
    reply: FastifyReply,
    credentials: AuthCredentials,
    secureCookie: boolean,
  ): Promise<AuthUser> {
    if (await this.sessionUser(request, reply, secureCookie)) {
      throw new HttpError(
        409,
        'already_authenticated',
        'Cierra la sesión actual para crear otra cuenta.',
      );
    }
    const accountId = existingAnonymousOwnerId(request) ?? randomUUID();
    const passwordHash = await hashPassword(credentials.password);
    const token = randomBytes(32).toString('base64url');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO accounts (id, email, password_hash) VALUES ($1, $2, $3)', [
        accountId,
        credentials.email,
        passwordHash,
      ]);
      await insertSession(client, accountId, token);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueEmailViolation(error)) {
        throw new HttpError(
          409,
          'email_already_registered',
          'Ya existe una cuenta con este correo.',
        );
      }
      throw error;
    } finally {
      client.release();
    }
    setSessionCookie(reply, token, secureCookie);
    rotateAnonymousOwnerCookie(reply, secureCookie);
    return { id: accountId, email: credentials.email };
  }

  async login(
    reply: FastifyReply,
    credentials: AuthCredentials,
    secureCookie: boolean,
  ): Promise<AuthUser> {
    const result = await this.pool.query<AccountRow>(
      'SELECT id, email, password_hash FROM accounts WHERE lower(email) = $1',
      [credentials.email],
    );
    const account = result.rows[0];
    const passwordIsValid = await verifyPassword(
      credentials.password,
      account?.password_hash ?? DUMMY_PASSWORD_HASH,
    );
    if (!account || !passwordIsValid) {
      throw new HttpError(
        401,
        'invalid_credentials',
        'El correo o la contraseña no son correctos.',
      );
    }
    const token = randomBytes(32).toString('base64url');
    await this.pool.query(
      'INSERT INTO auth_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)',
      [sessionDigest(token), account.id, new Date(Date.now() + SESSION_TTL_MS)],
    );
    setSessionCookie(reply, token, secureCookie);
    return { id: account.id, email: account.email };
  }

  async logout(request: FastifyRequest, reply: FastifyReply, secureCookie: boolean): Promise<void> {
    const token = sessionTokenFromRequest(request);
    if (token) {
      await this.pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [
        sessionDigest(token),
      ]);
    }
    clearSessionCookie(reply, secureCookie);
  }
}

async function insertSession(client: PoolClient, accountId: string, token: string): Promise<void> {
  await client.query(
    'INSERT INTO auth_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)',
    [sessionDigest(token), accountId, new Date(Date.now() + SESSION_TTL_MS)],
  );
}

function isUniqueEmailViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'accounts_email_lower_idx'
  );
}
