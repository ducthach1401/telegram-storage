import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FolderResponseDto } from './folder-response.dto';
import { StoredFileSummaryDto } from './stored-file-summary.dto';

export class TrashedFileDto extends StoredFileSummaryDto {
  @ApiProperty({ type: String, format: 'date-time' })
  deletedAt: Date;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  deletedOriginalFolderId: string | null;

  @ApiPropertyOptional({ nullable: true })
  deletedOriginalName: string | null;
}

export class TrashedFolderDto extends FolderResponseDto {
  @ApiProperty({ type: String, format: 'date-time' })
  deletedAt: Date;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  deletedOriginalParentId: string | null;

  @ApiPropertyOptional({ nullable: true })
  deletedOriginalName: string | null;
}

export class TrashListResponseDto {
  @ApiProperty({ type: [FolderResponseDto] })
  folders: TrashedFolderDto[];

  @ApiProperty({ type: [TrashedFileDto] })
  items: TrashedFileDto[];
}
