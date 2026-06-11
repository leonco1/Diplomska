import {
  Body,
  Controller,
  Post,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatRequestDto, EmotionRequestDto } from './chat.dto';
import { ChatService, type TextEmotionResult } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  async send(@Body() dto: ChatRequestDto, @Res() res: Response) {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();

    if (!this.chat.isConfigured) {
      res.write(
        `data: ${JSON.stringify({
          error: 'The support bot is not configured (missing OPENAI_API_KEY).',
        })}\n\n`,
      );
      res.end();
      return;
    }

    try {
      for await (const chunk of this.chat.streamReply(dto.messages)) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unexpected error from the AI service.';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }

  /**
   * Classifies the dominant emotion of a single piece of text via the same
   * OpenAI path the support bot uses. Plain JSON (no streaming).
   */
  @Post('emotion')
  async emotion(@Body() dto: EmotionRequestDto): Promise<TextEmotionResult> {
    if (!this.chat.isConfigured) {
      throw new ServiceUnavailableException(
        'Emotion classification is not configured (missing OPENAI_API_KEY).',
      );
    }
    return this.chat.classifyEmotion(dto.text);
  }
}
