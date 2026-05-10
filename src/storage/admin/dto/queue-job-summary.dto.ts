import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueueJobSummaryDto {
  @ApiPropertyOptional()
  id?: string;

  @ApiPropertyOptional({ description: 'Tên job (vd. persist)' })
  name?: string;

  @ApiProperty()
  state: string;

  @ApiPropertyOptional()
  attemptsMade?: number;

  @ApiPropertyOptional()
  attempts?: number;

  @ApiPropertyOptional({ description: 'Tên file upload, không gồm đường dẫn file tạm' })
  fileName?: string;

  @ApiPropertyOptional()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Có thể retry lại job failed hay không' })
  canRetry?: boolean;

  @ApiPropertyOptional()
  failedReason?: string;

  @ApiPropertyOptional({ description: 'Unix ms khi tạo job' })
  timestamp?: number;

  @ApiPropertyOptional()
  processedOn?: number;

  @ApiPropertyOptional()
  finishedOn?: number;
}
