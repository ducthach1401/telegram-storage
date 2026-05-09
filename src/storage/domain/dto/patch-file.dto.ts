import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Ít nhất một trong `name` hoặc `folderId` — kiểm tra ở controller. `folderId` có thể là UUID hoặc `root`. */
export class PatchFileDto {
  @ApiPropertyOptional({ description: 'Tên file mới trong thư mục đích' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  name?: string;

  @ApiPropertyOptional({
    description: 'Thư mục đích: UUID hoặc `root`',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  folderId?: string;
}
