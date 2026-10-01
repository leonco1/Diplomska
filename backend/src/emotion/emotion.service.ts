import { Injectable, Logger } from '@nestjs/common';
import '@tensorflow/tfjs-node';
import { Human, type Config } from '@vladmandic/human';

export interface EmotionScore {
  emotion: string;
  score: number;
}

export interface FaceEmotionResult {
  faceDetected: boolean;
  dominant: EmotionScore | null;
  emotions: EmotionScore[];
}

const HUMAN_CONFIG: Partial<Config> = {
  backend: 'tensorflow',
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  cacheSensitivity: 0,
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 1 },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: false },
    emotion: { enabled: true },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  filter: { enabled: false },
};

@Injectable()
export class EmotionService {
  private readonly logger = new Logger(EmotionService.name);
  private readonly human = new Human(HUMAN_CONFIG);
  private warmup: Promise<void> | null = null;

  private async ready(): Promise<void> {
    if (!this.warmup) {
      this.warmup = this.human.load().then(() => {
        this.logger.log('Human face/emotion models loaded.');
      });
    }
    return this.warmup;
  }

  async detectFace(image: Buffer): Promise<FaceEmotionResult> {
    await this.ready();

    const tensor = this.human.tf.node.decodeImage(image, 3);
    try {
      const result = await this.human.detect(tensor);
      const face = result.face?.[0];
      if (!face || !face.emotion?.length) {
        return { faceDetected: false, dominant: null, emotions: [] };
      }

      const emotions: EmotionScore[] = face.emotion
        .map((e) => ({ emotion: e.emotion, score: e.score }))
        .sort((a, b) => b.score - a.score);

      return { faceDetected: true, dominant: emotions[0], emotions };
    } finally {
      this.human.tf.dispose(tensor);
    }
  }
}
