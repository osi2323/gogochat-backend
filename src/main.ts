import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertProductionEnv } from './config/env';
import { apiSecurityHeaders, parseCorsOrigins } from './config/http-security';

async function bootstrap() {
  assertProductionEnv();

  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  // Render TLS'i Node'a iletmeden önce sonlandırır.
  // İlk proxy'ye güveniyoruz ki gerçek istemci IP bilgisi doğru alınsın.
  const express = app.getHttpAdapter().getInstance();

  express.set('trust proxy', 1);
  express.disable('x-powered-by');

  app.use(apiSecurityHeaders);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = parseCorsOrigins(
    process.env.CORS_ORIGINS ?? 'http://localhost:3000',
  );

  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      // Server-to-server isteklerde Origin olmayabilir.
      // Browser isteklerinde yalnızca izin verilen origin'leri kabul ediyoruz.
      if (!origin || origins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error('Origin is not allowed by CORS'),
        false,
      );
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