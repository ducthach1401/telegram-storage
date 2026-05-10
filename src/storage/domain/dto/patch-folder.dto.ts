import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PatchFolderDto {
  @ApiPropertyOptional({ description: 'Thư mục cha mới: UUID hoặc `root`' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  parentId?: string;
}
