import { ApiProperty } from '@nestjs/swagger';
import { QueueJobSummaryDto } from './queue-job-summary.dto';

export class QueueJobsListResponseDto {
  @ApiProperty({ type: [QueueJobSummaryDto] })
  jobs: QueueJobSummaryDto[];
}
