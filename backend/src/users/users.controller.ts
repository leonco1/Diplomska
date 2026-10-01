import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';
import { UsersService } from './users.service';
import { RecordViewDto } from './dto/record-view.dto';
import { SaveEmotionDto } from './dto/save-emotion.dto';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() auth: AuthUser) {
    return {
      id: auth.user.id,
      keycloakId: auth.user.keycloakId,
      email: auth.user.email,
      username: auth.user.username,
      roles: auth.roles,
    };
  }

  @Get('history')
  history(@CurrentUser('user') user: AuthUser['user']) {
    return this.users.getHistory(user);
  }

  @Post('history')
  recordView(
    @CurrentUser('user') user: AuthUser['user'],
    @Body() dto: RecordViewDto,
  ) {
    return this.users.recordView(user, dto.videoId, dto.positionSeconds ?? 0);
  }

  @Post('emotions')
  saveEmotion(
    @CurrentUser('user') user: AuthUser['user'],
    @Body() dto: SaveEmotionDto,
  ) {
    return this.users.saveEmotionSample(user, dto);
  }

  @Get('emotions')
  emotions(@CurrentUser('user') user: AuthUser['user']) {
    return this.users.getEmotionOverview(user);
  }

  @Get('videos/:videoId/emotions')
  videoEmotions(
    @CurrentUser('user') user: AuthUser['user'],
    @Param('videoId') videoId: string,
  ) {
    return this.users.getVideoEmotionStats(user, videoId);
  }
}
