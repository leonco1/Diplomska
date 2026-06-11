import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from './videos/video.entity';
import { User } from './users/user.entity';
import { VideoView } from './users/video-view.entity';
import { EmotionSample } from './users/emotion-sample.entity';
import { VideosModule } from './videos/videos.module';
import { ChatModule } from './chat/chat.module';
import { EmotionModule } from './emotion/emotion.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER || 'streamapp',
      password: process.env.DB_PASSWORD || 'streamapp',
      database: process.env.DB_NAME || 'streamapp',
      entities: [Video, User, VideoView, EmotionSample],
      // Auto-create tables from entities. Fine for a thesis/demo;
      // use migrations instead for production.
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    VideosModule,
    ChatModule,
    EmotionModule,
  ],
  providers: [
    // Authenticate every request (except @Public routes), then check @Roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
