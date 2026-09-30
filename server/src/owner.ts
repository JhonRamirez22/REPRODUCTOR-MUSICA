import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// TODO: migrate to real accounts if the product requires it.
export function ownerIdForRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  secureCookie: boolean,
): string {
  const cookie = request.cookies.owner_id;
  const verified = cookie ? request.unsignCookie(cookie) : null;
  if (verified?.valid && verified.value && UUID_PATTERN.test(verified.value)) return verified.value;

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
