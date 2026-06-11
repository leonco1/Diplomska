import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import type { Request, Response } from 'express';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideosService } from './videos.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get()
  findAll() {
    return this.videos.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videos.findOne(id);
  }

  // Storage, size limit, and video-only filter are configured in VideosModule.
  @Post()
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateVideoDto,
  ) {
    if (!file) {
      throw new BadRequestException('A video file is required');
    }
    return this.videos.create(file, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.videos.remove(id);
  }

  /**
   * Streams the video file, honoring HTTP Range requests so the browser can
   * seek/scrub. Responds 206 Partial Content for ranged requests, 200 otherwise.
   */
  @Get(':id/stream')
  @Public()
  async stream(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const video = await this.videos.findOne(id);
    const path = this.videos.filePath(video.filename);

    const size = await stat(path)
      .then((s) => s.size)
      .catch(() => {
        throw new NotFoundException('File missing on disk');
      });

    const range = req.headers.range;
    if (range) {
      // Format: "bytes=START-END"
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : size - 1;

      if (start >= size || end >= size || start > end) {
        res.status(416).set('Content-Range', `bytes */${size}`).end();
        return;
      }

      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': video.mimeType,
      });
      createReadStream(path, { start, end }).pipe(res);
    } else {
      res.status(200).set({
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
        'Content-Type': video.mimeType,
      });
      createReadStream(path).pipe(res);
    }
  }
}
