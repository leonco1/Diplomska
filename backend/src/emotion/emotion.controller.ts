import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { FaceEmotionDto } from './emotion.dto';
import { EmotionService, type FaceEmotionResult } from './emotion.service';

@Controller('emotion')
export class EmotionController {
  constructor(private readonly emotion: EmotionService) {}

  /**
   * Detects the dominant facial emotion in a single webcam frame.
   * The frame is sent as a base64 (data-URL) JPEG/PNG from the browser.
   */
  @Post('face')
  async face(@Body() dto: FaceEmotionDto): Promise<FaceEmotionResult> {
    const base64 = dto.image.includes(',')
      ? dto.image.slice(dto.image.indexOf(',') + 1)
      : dto.image;

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('Empty or invalid image data');
    }

    try {
      return await this.emotion.detectFace(buffer);
    } catch {
      throw new BadRequestException('Could not decode the image');
    }
  }
}
