import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') || 'localhost',
        port: Number(config.get<string>('DB_PORT') ?? 5432),
        username: config.get<string>('DB_USER') || 'streamapp',
        password: config.get<string>('DB_PASSWORD') || 'streamapp',
        database: config.get<string>('DB_NAME') || 'streamapp',
        entities: [Video, User, VideoView, EmotionSample],
        synchronize: true,
      }),
    }),
    AuthModule,
    UsersModule,
    VideosModule,
    ChatModule,
    EmotionModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
