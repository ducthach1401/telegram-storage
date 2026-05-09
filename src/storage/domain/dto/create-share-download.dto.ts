import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateShareDownloadDto {
  @ApiPropertyOptional({
    default: 86400,
    minimum: 60,
    maximum: 604800,
    description: 'Thời gian sống token (giây); tối đa 7 ngày',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(604800)
  ttlSeconds?: number;
}
