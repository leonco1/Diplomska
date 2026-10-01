import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Video } from './video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videos: Repository<Video>,
  ) {}

  findAll() {
    return this.videos.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const video = await this.videos.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException(`Video ${id} not found`);
    }
    return video;
  }

  create(file: Express.Multer.File, dto: CreateVideoDto) {
    if (!file) {
      throw new BadRequestException('No file received');
    }
    const video = this.videos.create({
      title: dto.title,
      description: dto.description ?? '',
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    });
    return this.videos.save(video);
  }

  async update(id: string, dto: UpdateVideoDto) {
    const video = await this.findOne(id);
    if (dto.title !== undefined) video.title = dto.title;
    if (dto.description !== undefined) video.description = dto.description;
    return this.videos.save(video);
  }

  async remove(id: string) {
    const video = await this.findOne(id);
    await fs.unlink(join(UPLOAD_DIR, video.filename)).catch(() => undefined);
    await this.videos.delete({ id });
    return { deleted: true };
  }

  filePath(filename: string) {
    return join(UPLOAD_DIR, filename);
  }
}
