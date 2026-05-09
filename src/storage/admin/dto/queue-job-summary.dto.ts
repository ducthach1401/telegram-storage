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
  failedReason?: string;

  @ApiPropertyOptional({ description: 'Unix ms khi tạo job' })
  timestamp?: number;

  @ApiPropertyOptional()
  processedOn?: number;

  @ApiPropertyOptional()
  finishedOn?: number;
}
