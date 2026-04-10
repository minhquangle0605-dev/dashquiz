import type { Request } from 'express';

/** Client IP for rate limiting / lockout (supports X-Forwarded-For behind a proxy). */
export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return xff[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}
