import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VideoView } from './video-view.entity';
import { EmotionSample } from './emotion-sample.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  keycloakId: string;

  @Column({ default: '' })
  email: string;

  @Column({ default: '' })
  username: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => VideoView, (view) => view.user)
  views: VideoView[];

  @OneToMany(() => EmotionSample, (sample) => sample.user)
  emotionSamples: EmotionSample[];
}
