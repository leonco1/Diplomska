import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class RecordViewDto {
  @IsUUID()
  videoId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  positionSeconds?: number;
}
