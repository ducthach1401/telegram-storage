import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const FILE_SEARCH_MODES = ['substring', 'prefix'] as const;

export class FileSearchQueryDto {
  @ApiProperty({ description: 'Chuỗi tìm trong tên file' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;

  @ApiPropertyOptional({
    description: 'Lọc theo thư mục: UUID hoặc `root`; bỏ qua = toàn bộ',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : value))
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ enum: FILE_SEARCH_MODES, default: 'substring' })
  @IsOptional()
  @IsIn([...FILE_SEARCH_MODES])
  mode?: (typeof FILE_SEARCH_MODES)[number];

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
