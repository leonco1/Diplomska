import { BadRequestException, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { VideosController } from './videos.controller';
import { UPLOAD_DIR, VideosService } from './videos.service';
import { Video } from './video.entity';

const DEFAULT_MAX_UPLOAD_BYTES = 524_288_000;

@Module({
  imports: [
    TypeOrmModule.forFeature([Video]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          destination: UPLOAD_DIR,
          filename: (_req, file, cb) => {
            const unique = randomBytes(16).toString('hex');
            cb(null, `${unique}${extname(file.originalname)}`);
          },
        }),
        limits: {
          fileSize: Number(
            config.get<string>('MAX_UPLOAD_BYTES') ?? DEFAULT_MAX_UPLOAD_BYTES,
          ),
        },
        fileFilter: (_req, file, cb) => {
          if (file.mimetype.startsWith('video/')) {
            cb(null, true);
          } else {
            cb(new BadRequestException('Only video files are allowed'), false);
          }
        },
      }),
    }),
  ],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
