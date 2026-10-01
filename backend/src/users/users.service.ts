import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { VideoView } from './video-view.entity';
import { EmotionSample } from './emotion-sample.entity';
import { Video } from '../videos/video.entity';

export interface EmotionAggregate {
  emotion: string;
  averageScore: number;
  count: number;
}

export interface VideoEmotionStats {
  videoId: string;
  sampleCount: number;
  samples: EmotionSample[];
  aggregate: EmotionAggregate[];
}

export interface VideoEmotionSummary {
  video: Video;
  sampleCount: number;
  samples: EmotionSample[];
  aggregate: EmotionAggregate[];
}

export interface EmotionOverview {
  totalSamples: number;
  lifetime: EmotionAggregate[];
  perVideo: VideoEmotionSummary[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(VideoView)
    private readonly views: Repository<VideoView>,
    @InjectRepository(EmotionSample)
    private readonly samples: Repository<EmotionSample>,
    @InjectRepository(Video)
    private readonly videos: Repository<Video>,
  ) {}

  async upsertFromToken(claims: {
    keycloakId: string;
    email: string;
    username: string;
  }): Promise<User> {
    let user = await this.users.findOne({
      where: { keycloakId: claims.keycloakId },
    });
    if (!user) {
      user = this.users.create({
        keycloakId: claims.keycloakId,
        email: claims.email,
        username: claims.username,
      });
    } else if (
      user.email !== claims.email ||
      user.username !== claims.username
    ) {
      user.email = claims.email;
      user.username = claims.username;
    } else {
      return user;
    }
    return this.users.save(user);
  }

  private async getVideo(videoId: string): Promise<Video> {
    const video = await this.videos.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException(`Video ${videoId} not found`);
    return video;
  }

  async recordView(
    user: User,
    videoId: string,
    positionSeconds = 0,
  ): Promise<VideoView> {
    const video = await this.getVideo(videoId);
    let view = await this.views.findOne({
      where: { user: { id: user.id }, video: { id: video.id } },
    });
    if (!view) {
      view = this.views.create({
        user,
        video,
        lastPositionSeconds: positionSeconds,
      });
    } else {
      view.lastPositionSeconds = positionSeconds;
    }
    return this.views.save(view);
  }

  getHistory(user: User): Promise<VideoView[]> {
    return this.views.find({
      where: { user: { id: user.id } },
      order: { watchedAt: 'DESC' },
    });
  }

  async saveEmotionSample(
    user: User,
    data: {
      videoId: string;
      tSeconds: number;
      dominantEmotion: string;
      score: number;
      scores?: Record<string, number>;
    },
  ): Promise<EmotionSample> {
    const video = await this.getVideo(data.videoId);
    const sample = this.samples.create({
      user,
      video,
      tSeconds: data.tSeconds,
      dominantEmotion: data.dominantEmotion,
      score: data.score,
      scores: data.scores ?? {},
    });
    return this.samples.save(sample);
  }

  async getVideoEmotionStats(
    user: User,
    videoId: string,
  ): Promise<VideoEmotionStats> {
    const samples = await this.samples.find({
      where: { user: { id: user.id }, video: { id: videoId } },
      order: { tSeconds: 'ASC', createdAt: 'ASC' },
    });
    return {
      videoId,
      sampleCount: samples.length,
      samples,
      aggregate: this.aggregate(samples),
    };
  }

  async getEmotionOverview(user: User): Promise<EmotionOverview> {
    const samples = await this.samples.find({
      where: { user: { id: user.id } },
      relations: { video: true },
      order: { tSeconds: 'ASC', createdAt: 'ASC' },
    });

    const byVideo = new Map<string, EmotionSample[]>();
    for (const s of samples) {
      if (!s.video) continue;
      const list = byVideo.get(s.video.id) ?? [];
      list.push(s);
      byVideo.set(s.video.id, list);
    }

    const perVideo: VideoEmotionSummary[] = [...byVideo.values()]
      .map((list) => ({
        video: list[0].video,
        sampleCount: list.length,
        samples: list,
        aggregate: this.aggregate(list),
      }))
      .sort((a, b) => b.sampleCount - a.sampleCount);

    return {
      totalSamples: samples.length,
      lifetime: this.aggregate(samples),
      perVideo,
    };
  }

  private aggregate(samples: EmotionSample[]): EmotionAggregate[] {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const s of samples) {
      const t = totals.get(s.dominantEmotion) ?? { sum: 0, count: 0 };
      t.sum += s.score;
      t.count += 1;
      totals.set(s.dominantEmotion, t);
    }
    return [...totals.entries()]
      .map(([emotion, { sum, count }]) => ({
        emotion,
        averageScore: count ? sum / count : 0,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
