import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Video } from '../videos/video.entity';

/**
 * One row per (user, video) the user has watched — the watch history.
 * Re-watching the same video updates `watchedAt`/`lastPositionSeconds`
 * rather than inserting a duplicate (enforced by the composite unique index).
 */
@Entity('video_views')
@Index(['user', 'video'], { unique: true })
export class VideoView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.views, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Video, { onDelete: 'CASCADE', eager: true })
  video: Video;

  /** Last known playback position, in seconds. */
  @Column({ type: 'int', default: 0 })
  lastPositionSeconds: number;

  @CreateDateColumn()
  firstWatchedAt: Date;

  @UpdateDateColumn()
  watchedAt: Date;
}
