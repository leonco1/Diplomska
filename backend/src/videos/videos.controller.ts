import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { CreateVideoDto } from './dto/create-video.dto';
import { UPLOAD_DIR, VideosService } from './videos.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 524288000);

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

  @Post()
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = randomBytes(16).toString('hex');
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only video files are allowed'), false);
        }
      },
    }),
  )
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

    if (!existsSync(path)) {
      throw new BadRequestException('File missing on disk');
    }

    const { size } = statSync(path);
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

      const chunkSize = end - start + 1;
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
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
