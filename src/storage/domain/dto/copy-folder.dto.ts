import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CopyFolderDto {
  @ApiPropertyOptional({
    description:
      'Thư mục cha của bản sao; `root` hoặc UUID. Bỏ trống = root ảo.',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}
