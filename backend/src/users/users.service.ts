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

  /**
   * Find the local user for a Keycloak identity, creating it on first sight
   * and keeping email/username in sync with the token (JIT provisioning).
   */
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
    } else if (user.email !== claims.email || user.username !== claims.username) {
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

  /** Record (or refresh) that a user watched a video. */
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
      view = this.views.create({ user, video, lastPositionSeconds: positionSeconds });
    } else {
      view.lastPositionSeconds = positionSeconds;
    }
    return this.views.save(view);
  }

  /** A user's watch history, most recently watched first. */
  getHistory(user: User): Promise<VideoView[]> {
    return this.views.find({
      where: { user: { id: user.id } },
      order: { watchedAt: 'DESC' },
    });
  }

  /** Persist one facial-emotion reading captured while watching a video. */
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

  /** Per-watch emotion timeline + a simple per-emotion average for charting. */
  async getVideoEmotionStats(
    user: User,
    videoId: string,
  ): Promise<VideoEmotionStats> {
    const samples = await this.samples.find({
      where: { user: { id: user.id }, video: { id: videoId } },
      order: { tSeconds: 'ASC', createdAt: 'ASC' },
    });

    // Average the dominant score per dominant emotion.
    const totals = new Map<string, { sum: number; count: number }>();
    for (const s of samples) {
      const t = totals.get(s.dominantEmotion) ?? { sum: 0, count: 0 };
      t.sum += s.score;
      t.count += 1;
      totals.set(s.dominantEmotion, t);
    }
    const aggregate: EmotionAggregate[] = [...totals.entries()]
      .map(([emotion, { sum, count }]) => ({
        emotion,
        averageScore: count ? sum / count : 0,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return { videoId, sampleCount: samples.length, samples, aggregate };
  }
}
