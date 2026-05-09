import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReconcileRequestDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Chỉ quét và đếm; không xóa DB / không gọi deleteMessage',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  batchSize?: number;

  @ApiPropertyOptional({
    default: 1000,
    minimum: 1,
    maximum: 100_000,
    description: 'Giới hạn số file tối đa quét trong một lần chạy',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxTotal?: number;

  @ApiPropertyOptional({
    default: 50,
    minimum: 0,
    maximum: 500,
    description: 'Nghỉ (ms) sau mỗi file khi gọi Telegram getFile (tránh rate limit)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  delayMsBetweenChecks?: number;
}
