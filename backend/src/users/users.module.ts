import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { VideoView } from './video-view.entity';
import { EmotionSample } from './emotion-sample.entity';
import { Video } from '../videos/video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, VideoView, EmotionSample, Video])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
