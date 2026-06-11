import { IsString, Matches, MaxLength } from 'class-validator';

export class FaceEmotionDto {
  /**
   * A data URL ("data:image/jpeg;base64,...") or a bare base64 image string.
   * Captured client-side from a webcam frame. Capped to keep payloads sane
   * (~5 MB of base64 ≈ a high-res still, far more than we need).
   */
  @IsString()
  @MaxLength(7_000_000)
  @Matches(/^(data:image\/(jpeg|png);base64,)?[A-Za-z0-9+/=\s]+$/, {
    message: 'image must be a base64 (optionally data-URL) encoded JPEG/PNG',
  })
  image: string;
}
