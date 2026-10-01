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

@Entity('emotion_samples')
@Index(['user', 'video'])
export class EmotionSample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.emotionSamples, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  video: Video;

  @Column({ type: 'int', default: 0 })
  tSeconds: number;

  @Column()
  dominantEmotion: string;

  @Column({ type: 'float', default: 0 })
  score: number;

  @Column({ type: 'jsonb', default: {} })
  scores: Record<string, number>;

  @CreateDateColumn()
  createdAt: Date;
}
