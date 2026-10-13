import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });
  const logger = new Logger();
  const configService = app.get(ConfigService);
  const port = Number(configService.get('APP_PORT', '4000'));
  const appUrl = configService.get('APP_URL', `http://localhost:${port}/api`);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('api');
  app.useLogger(logger);
  app.useGlobalPipes(
    new ValidationPipe({
      // Keep only request properties declared with validation decorators.
      whitelist: true,

      // Reject unknown properties instead of silently removing them.
      forbidNonWhitelisted: true,

      // Convert incoming payloads to their DTO classes and declared types.
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Baloot Org API')
    // These two only show lock icons per route in Swagger.
    // The browser sends the real cookies by itself (httponly).
    .addCookieAuth('access_token', undefined, 'access_token')
    .addCookieAuth('refresh_token', undefined, 'refresh_token')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
    useGlobalPrefix: true,
    // Hide the Authorize button;
    customCss: '.swagger-ui .auth-wrapper { display: none; }',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  logger.log(`Application is running at ${appUrl}`);
}
bootstrap();
