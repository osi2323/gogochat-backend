"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiSecurityHeaders = apiSecurityHeaders;
exports.parseCorsOrigins = parseCorsOrigins;
function apiSecurityHeaders(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
}
function parseCorsOrigins(raw = '') {
    return [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))];
}
//# sourceMappingURL=http-security.js.map