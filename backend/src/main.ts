import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './videos/videos.service';

async function bootstrap() {
  // Ensure the uploads directory exists before anything tries to write to it.
  mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('FRONTEND_ORIGIN') || 'http://localhost:5173',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  Logger.log(`Backend running on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
