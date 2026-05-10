import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QueueJobSummaryDto } from './queue-job-summary.dto';

export class QueueRetryResponseDto {
  @ApiProperty({ example: 3 })
  retried: number;

  @ApiProperty({ example: 0 })
  skipped: number;

  @ApiPropertyOptional({ type: [QueueJobSummaryDto] })
  jobs?: QueueJobSummaryDto[];
}
