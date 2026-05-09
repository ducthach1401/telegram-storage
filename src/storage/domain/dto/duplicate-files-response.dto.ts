import { ApiProperty } from '@nestjs/swagger';
import { StoredFileSummaryDto } from './stored-file-summary.dto';

export class DuplicateFileGroupDto {
  @ApiProperty({ description: 'Cùng một binary trên Telegram (file_unique_id)' })
  telegramFileUniqueId: string;

  @ApiProperty({ type: [StoredFileSummaryDto] })
  files: StoredFileSummaryDto[];
}

export class DuplicateFilesResponseDto {
  @ApiProperty({ type: [DuplicateFileGroupDto] })
  groups: DuplicateFileGroupDto[];
}
