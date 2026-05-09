import { ApiProperty } from "@nestjs/swagger";
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
}
