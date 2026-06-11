import { Injectable, Logger } from '@nestjs/common';
// tfjs-node registers the native "tensorflow" backend as a side effect.
// It must be imported before Human so the backend is available at detect time.
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

// Only enable the face detector + emotion model. Everything else off to keep
// each detect() call fast and the model download small.
const HUMAN_CONFIG: Partial<Config> = {
  backend: 'tensorflow',
  // Load model weights over HTTP from the official Human models host so we
  // don't have to vendor them into the repo.
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  cacheSensitivity: 0,
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 1 },
    mesh: { enabled: true }, // emotion model needs the face mesh
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

  /** Lazily load models on first use (and reuse the same promise afterwards). */
  private async ready(): Promise<void> {
    if (!this.warmup) {
      this.warmup = this.human.load().then(() => {
        this.logger.log('Human face/emotion models loaded.');
      });
    }
    return this.warmup;
  }

  /**
   * Runs face + emotion detection on a raw image buffer (JPEG/PNG).
   * Returns the dominant emotion and the full score list, sorted high→low.
   */
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
