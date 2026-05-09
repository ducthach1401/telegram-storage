import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FolderContentsQueryDto {
  @ApiPropertyOptional({
    description:
      'Giới hạn số file trả về (phân trang). Không gửi = trả toàn bộ file như trước.',
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  fileLimit?: number;

  @ApiPropertyOptional({
    description:
      'Cursor trang tiếp (giá trị filesNextCursor từ response trước); chỉ dùng khi có fileLimit.',
  })
  @IsOptional()
  @IsString()
  fileCursor?: string;

  @ApiPropertyOptional({
    description:
      'Giới hạn số thư mục con trả về (phân trang). Không gửi = trả toàn bộ thư mục con như trước.',
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  folderLimit?: number;

  @ApiPropertyOptional({
    description:
      'Cursor trang tiếp (giá trị foldersNextCursor từ response trước); chỉ dùng khi có folderLimit.',
  })
  @IsOptional()
  @IsString()
  folderCursor?: string;
}
