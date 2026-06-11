import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Video } from '../videos/video.entity';

/**
 * A single facial-emotion reading captured while a user watched a given video.
 * The full per-watch timeline is the set of samples for one (user, video).
 */
@Entity('emotion_samples')
@Index(['user', 'video'])
export class EmotionSample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.emotionSamples, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  video: Video;

  /** Seconds since emotion tracking started for this watch session. */
  @Column({ type: 'int', default: 0 })
  tSeconds: number;

  @Column()
  dominantEmotion: string;

  @Column({ type: 'float', default: 0 })
  score: number;

  /** Full per-emotion score map (e.g. { happy: 0.7, neutral: 0.2, ... }). */
  @Column({ type: 'jsonb', default: {} })
  scores: Record<string, number>;

  @CreateDateColumn()
  createdAt: Date;
}
