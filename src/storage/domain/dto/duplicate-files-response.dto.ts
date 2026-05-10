import { ApiProperty } from '@nestjs/swagger';
import { StoredFileSummaryDto } from './stored-file-summary.dto';

export class DuplicateFileGroupDto {
  @ApiProperty({ description: 'Cùng một binary trên Telegram (file_unique_id)' })
  telegramFileUniqueId: string | null;

  @ApiProperty({ nullable: true, description: 'SHA-256 dùng để nhận diện file trùng nội dung' })
  contentSha256: string | null;

  @ApiProperty({ type: [StoredFileSummaryDto] })
  files: StoredFileSummaryDto[];
}

export class DuplicateFilesResponseDto {
  @ApiProperty({ type: [DuplicateFileGroupDto] })
  groups: DuplicateFileGroupDto[];
}

export class DuplicateCleanupResponseDto {
  @ApiProperty({ description: 'Số nhóm file trùng đã xử lý' })
  groups: number;

  @ApiProperty({ description: 'Số file duplicate đã đưa vào thùng rác' })
  deleted: number;

  @ApiProperty({ type: [StoredFileSummaryDto], description: 'Các bản duplicate đã xóa mềm' })
  files: StoredFileSummaryDto[];
}
