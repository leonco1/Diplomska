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

/**
 * Local mirror of a Keycloak identity. Created lazily (JIT) the first time a
 * user makes an authenticated request — Keycloak remains the source of truth
 * for credentials/roles; this row just anchors our own relations.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Keycloak subject (`sub` claim) — stable per user, unique. */
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
