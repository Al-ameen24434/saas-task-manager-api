import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');

  // Global API prefix (e.g., /api/v1)
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe — validates all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // Strip unknown properties
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true,         // Auto-transform types (string -> number, etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS — configure properly for your frontend domain in production
  app.enableCors({
    origin: nodeEnv === 'production' ? process.env.FRONTEND_URL : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger / OpenAPI Documentation
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Task Management API')
      .setDescription(
        'A production-grade SaaS Task Management API built with NestJS, PostgreSQL, and Prisma',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth',
      )
      .addTag('Auth', 'Authentication endpoints')
      .addTag('Users', 'User management')
      .addTag('Organizations', 'Organization management')
      .addTag('Projects', 'Project management')
      .addTag('Tasks', 'Task management')
      .addTag('Comments', 'Comment management')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // JWT stays across page refreshes
      },
    });
  }

  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════════╗
║          Task Management API is running! 🚀            ║
╠═══════════════════════════════════════════════════════╣
║  Environment : ${nodeEnv.padEnd(39)}║
║  Port        : ${String(port).padEnd(39)}║
║  API Prefix  : /${apiPrefix.padEnd(38)}║
║  Docs        : http://localhost:${port}/docs${' '.repeat(Math.max(0, 22 - String(port).length))}║
╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap();