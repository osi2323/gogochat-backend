import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import * as path from 'path';

const requestBodyLimit = '100mb';
const bootstrapLogger = new Logger('Bootstrap');

function isPostgresConnectionTimeout(reason: unknown): boolean {
  if (!(reason instanceof Error)) {
    return false;
  }

  const message = reason.message.toLowerCase();
  const causeMessage =
    reason.cause instanceof Error ? reason.cause.message.toLowerCase() : '';

  return (
    message.includes('timeout') &&
    (message.includes('connection') ||
      causeMessage.includes('connection terminated'))
  );
}

process.on('unhandledRejection', (reason) => {
  if (isPostgresConnectionTimeout(reason)) {
    bootstrapLogger.warn(
      `Unhandled PostgreSQL connection timeout ignored: ${
        reason instanceof Error ? reason.message : String(reason)
      }`,
    );
    return;
  }

  bootstrapLogger.error('Unhandled promise rejection', reason as any);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });

  if (process.env.pm_id && process.env.pm_id !== '0') {
    bootstrapLogger.warn(
      'Socket.IO adapter tanimli olmadan birden fazla PM2 instance kullaniliyor. Realtime yayinlar process sinirinda kalabilir.',
    );
  }

  // Increase body size limit for image/audio uploads
  app.use(express.json({ limit: requestBodyLimit }));
  app.use(express.urlencoded({ limit: requestBodyLimit, extended: true }));

  const configuredOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3029',
    'http://127.0.0.1:3029',
    ...configuredOrigins,
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant',
      'x-agent-nickname',
      'Cache-Control',
      'Pragma',
    ],
  });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('KingMobile Api')
    .setDescription('KingMobile Api')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('KingMobile')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'), {
      fallthrough: true,
    }),
  );

  try {
    await app.listen(process.env.PORT ?? 4000);
  } catch (error) {
    await app.close();
    throw error;
  }
}
bootstrap().catch((error) => {
  bootstrapLogger.error(
    `Application bootstrap failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
    error instanceof Error ? error.stack : undefined,
  );
  process.exit(1);
});
