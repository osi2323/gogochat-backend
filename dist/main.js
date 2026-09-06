"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const env_1 = require("./config/env");
const http_security_1 = require("./config/http-security");
async function bootstrap() {
    (0, env_1.assertProductionEnv)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableShutdownHooks();
    app.setGlobalPrefix('api');
    const express = app.getHttpAdapter().getInstance();
    express.set('trust proxy', 1);
    express.disable('x-powered-by');
    app.use(http_security_1.apiSecurityHeaders);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const origins = (0, http_security_1.parseCorsOrigins)(process.env.CORS_ORIGINS ?? 'http://localhost:3000');
    app.enableCors({
        origin(origin, callback) {
            if (!origin || origins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Origin is not allowed by CORS'), false);
        },
        credentials: true,
        methods: [
            'GET',
            'HEAD',
            'POST',
            'PATCH',
            'DELETE',
            'OPTIONS',
        ],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
        ],
    });
    const port = Number(process.env.PORT ?? 4000);
    await app.listen(port, '0.0.0.0');
}
void bootstrap();
//# sourceMappingURL=main.js.map