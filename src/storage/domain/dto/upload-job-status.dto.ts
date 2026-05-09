import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoredFileSummaryDto } from './stored-file-summary.dto';

export class UploadJobStatusDto {
  @ApiProperty()
  jobId: string;

  @ApiProperty({
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused', 'unknown'],
  })
  state: string;

  @ApiPropertyOptional({
    type: StoredFileSummaryDto,
    description: 'Có khi state = completed',
  })
  result?: StoredFileSummaryDto;

  @ApiPropertyOptional({ description: 'Có khi state = failed' })
  failedReason?: string;
}
