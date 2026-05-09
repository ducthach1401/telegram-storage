import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FolderZipJobStatusDto {
  @ApiProperty()
  jobId: string;

  @ApiProperty({ description: 'Trạng thái BullMQ (waiting, active, completed, failed, …)' })
  state: string;

  @ApiPropertyOptional({
    description: 'Khi completed — dùng làm query token cho GET …/folders/download/stream',
  })
  zipDownloadToken?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  zipDownloadExpiresAt?: Date;

  @ApiPropertyOptional({
    description: 'Đường dẫn tương đối (kèm token trong query)',
    example: '/api/v1/folders/download/stream?token=…',
  })
  downloadStreamPath?: string;

  @ApiPropertyOptional()
  failedReason?: string;
}
