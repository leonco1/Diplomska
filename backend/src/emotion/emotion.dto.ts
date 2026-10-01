import { IsString, Matches, MaxLength } from 'class-validator';

export class FaceEmotionDto {
  @IsString()
  @MaxLength(7_000_000)
  @Matches(/^(data:image\/(jpeg|png);base64,)?[A-Za-z0-9+/=\s]+$/, {
    message: 'image must be a base64 (optionally data-URL) encoded JPEG/PNG',
  })
  image: string;
}
