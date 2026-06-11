import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveEmotionDto {
  @IsUUID()
  videoId: string;

  @IsInt()
  @Min(0)
  tSeconds: number;

  @IsString()
  @MaxLength(50)
  dominantEmotion: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  score: number;

  @IsOptional()
  @IsObject()
  scores?: Record<string, number>;
}
