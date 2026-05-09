import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FolderResponseDto } from "./folder-response.dto";
import { StoredFileSummaryDto } from "./stored-file-summary.dto";

export class FolderContentsResponseDto {
  @ApiProperty({
    format: "uuid",
    description: "ID thư mục đang xem (UUID gốc hoặc UUID thư mục con)",
  })
  folderId: string;

  @ApiProperty({ type: [FolderResponseDto] })
  folders: FolderResponseDto[];

  @ApiProperty({ type: [StoredFileSummaryDto] })
  files: StoredFileSummaryDto[];

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Cursor cho GET tiếp theo (kèm cùng folderLimit); null khi hết trang hoặc không phân trang thư mục.",
  })
  foldersNextCursor?: string | null;

  @ApiPropertyOptional({
    description: "folderLimit đã dùng (chỉ khi phân trang thư mục con)",
  })
  foldersLimit?: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Cursor cho GET tiếp theo (kèm cùng fileLimit); null khi hết trang hoặc không phân trang.",
  })
  filesNextCursor?: string | null;

  @ApiPropertyOptional({
    description: "fileLimit đã dùng (chỉ khi phân trang file)",
  })
  filesLimit?: number;
}
