import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function anonymousOwnerIdForRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  secureCookie: boolean,
): string {
  const existingOwnerId = existingAnonymousOwnerId(request);
  if (existingOwnerId) return existingOwnerId;

  return setAnonymousOwnerCookie(reply, secureCookie);
}

export function existingAnonymousOwnerId(request: FastifyRequest): string | null {
  const cookie = request.cookies.owner_id;
  const verified = cookie ? request.unsignCookie(cookie) : null;
  return verified?.valid && verified.value && UUID_PATTERN.test(verified.value)
    ? verified.value
    : null;
}

export function rotateAnonymousOwnerCookie(reply: FastifyReply, secureCookie: boolean): string {
  return setAnonymousOwnerCookie(reply, secureCookie);
}

function setAnonymousOwnerCookie(reply: FastifyReply, secureCookie: boolean): string {
  const ownerId = randomUUID();
  reply.setCookie('owner_id', ownerId, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return ownerId;
}
