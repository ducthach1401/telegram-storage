import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsArray,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const FILE_SEARCH_MODES = ['substring', 'prefix'] as const;
export const FILE_SEARCH_SORT_FIELDS = ['name', 'createdAt'] as const;
export const FILE_SEARCH_SORT_ORDERS = ['asc', 'desc'] as const;

export class FileSearchQueryDto {
  @ApiPropertyOptional({ description: 'Chuỗi tìm trong tên file' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q?: string;

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

  @ApiPropertyOptional({ description: 'Lọc chính xác MIME type, ví dụ image/png' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tiền tố MIME type, ví dụ image/' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimePrefix?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSize?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxSize?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ description: 'true = chỉ file có thumbnail, false = không thumbnail' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === '' ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  hasThumbnail?: boolean;

  @ApiPropertyOptional({
    description: 'Danh sách tag phân tách bằng dấu phẩy. File phải có đủ các tag này.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .flatMap((v) => String(v).split(','))
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (value === undefined || value === '') {
      return undefined;
    }
    return String(value)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: FILE_SEARCH_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn([...FILE_SEARCH_SORT_FIELDS])
  sortBy?: (typeof FILE_SEARCH_SORT_FIELDS)[number];

  @ApiPropertyOptional({ enum: FILE_SEARCH_SORT_ORDERS, default: 'asc' })
  @IsOptional()
  @IsIn([...FILE_SEARCH_SORT_ORDERS])
  sortOrder?: (typeof FILE_SEARCH_SORT_ORDERS)[number];
}
