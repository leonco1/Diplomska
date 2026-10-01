import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatMessageDto } from './chat.dto';

export const EMOTIONS = [
  'joy',
  'sadness',
  'anger',
  'fear',
  'surprise',
  'disgust',
  'neutral',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export interface TextEmotionResult {
  emotion: Emotion;
  confidence: number;
}

const EMOTION_SYSTEM_PROMPT = `You are an emotion classifier. Read the user's message and classify its dominant emotion.
Respond with ONLY a JSON object: {"emotion": <one of ${EMOTIONS.join(', ')}>, "confidence": <number 0-1>}.
Use "neutral" when no clear emotion is present. Do not add any text outside the JSON.`;

const SUPPORT_SYSTEM_PROMPT = `You are the friendly support assistant for "StreamApp", a web app where users upload and watch videos.

Your job is to help users with how to USE the app. Be concise, warm, and practical.

What you know about the app:
- Users can upload videos from the Upload page. Supported formats are common video types (MP4, WebM, MOV, etc.). Max upload size is 500 MB.
- Uploaded videos appear in the catalog on the Home page. Click any video to watch it.
- The video player supports play/pause, volume, fullscreen, and seeking (scrubbing the timeline).
- Users sign in through the app's login screen (Keycloak). Only admins can upload or delete videos; regular users can browse and watch everything.
- The History page lists videos the user has watched; the Emotion page summarises camera-based emotion readings recorded (opt-in) while watching.
- This is a student thesis project, so it is meant for demos rather than production traffic.

Guidance:
- If a video won't play, suggest checking the file format (re-encode to MP4/H.264 if needed) and refreshing the page.
- If an upload fails, suggest checking the file is a video and under 500 MB.
- For anything outside this app (general questions, coding help, etc.), politely steer back to app support.
- Never claim to perform actions you can't (you can't upload, delete, or change account settings for the user) — instead explain how they can do it themselves.`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    this.model = config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY is not set — the chat endpoint will return an error until it is configured.',
      );
    }
  }

  get isConfigured() {
    return this.client !== null;
  }

  async classifyEmotion(text: string): Promise<TextEmotionResult> {
    if (!this.client) {
      throw new Error('OpenAI is not configured on the server.');
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EMOTION_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<TextEmotionResult>;

    const emotion = EMOTIONS.includes(parsed.emotion as Emotion)
      ? (parsed.emotion as Emotion)
      : 'neutral';
    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0;

    return { emotion, confidence };
  }

  async *streamReply(messages: ChatMessageDto[]): AsyncGenerator<string> {
    if (!this.client) {
      throw new Error('OpenAI is not configured on the server.');
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages: [
        { role: 'system', content: SUPPORT_SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}
