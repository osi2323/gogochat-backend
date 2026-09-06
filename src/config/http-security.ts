import type { Request, Response, NextFunction } from 'express';

/** Lightweight API security headers without adding another runtime dependency. */
export function apiSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

export function parseCorsOrigins(raw = '') {
  return [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))];
}
