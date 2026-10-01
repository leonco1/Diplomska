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

@Entity('video_views')
@Index(['user', 'video'], { unique: true })
export class VideoView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.views, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Video, { onDelete: 'CASCADE', eager: true })
  video: Video;

  @Column({ type: 'int', default: 0 })
  lastPositionSeconds: number;

  @CreateDateColumn()
  firstWatchedAt: Date;

  @UpdateDateColumn()
  watchedAt: Date;
}
