import { ApiProperty } from '@nestjs/swagger';
import { StoredFileSummaryDto } from './stored-file-summary.dto';

export class FileSearchResponseDto {
  @ApiProperty({ type: [StoredFileSummaryDto] })
  items: StoredFileSummaryDto[];
}
