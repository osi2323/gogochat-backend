"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertProductionEnv = assertProductionEnv;
const requiredProductionEnv = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGINS'];
function assertProductionEnv(env = process.env) {
    if (env.NODE_ENV !== 'production')
        return;
    const missing = requiredProductionEnv.filter((key) => !env[key]?.trim());
    if (missing.length) {
        throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }
    if ((env.JWT_SECRET ?? '').length < 32) {
        throw new Error('JWT_SECRET must contain at least 32 characters in production.');
    }
    const origins = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    if (!origins.length || origins.some((origin) => origin === '*' || !/^https:\/\//i.test(origin))) {
        throw new Error('CORS_ORIGINS must contain explicit HTTPS origins in production; wildcards are not allowed.');
    }
}
//# sourceMappingURL=env.js.map