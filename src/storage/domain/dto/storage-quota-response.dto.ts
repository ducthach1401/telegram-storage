import { ApiProperty } from '@nestjs/swagger';

export class StorageMimeUsageDto {
  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({ example: 12 })
  files: number;

  @ApiProperty({ example: 10485760 })
  bytes: number;
}

export class StorageQuotaResponseDto {
  @ApiProperty({ example: 120 })
  totalFiles: number;

  @ApiProperty({ example: 8 })
  totalFolders: number;

  @ApiProperty({ example: 5368709120 })
  totalBytes: number;

  @ApiProperty({ example: 5 })
  trashedFiles: number;

  @ApiProperty({ example: 1048576 })
  trashedBytes: number;

  @ApiProperty({ example: 2147483648 })
  minioBytes: number;

  @ApiProperty({ example: 53687091200 })
  minioLimitBytes: number;

  @ApiProperty({ type: [StorageMimeUsageDto] })
  byMimeType: StorageMimeUsageDto[];
}
