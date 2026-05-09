import { ApiProperty } from "@nestjs/swagger";

/** Metadata file (GET /files/:id) */
export class FileMetaResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: "image/png" })
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiProperty({ format: "uuid" })
  folderId: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: Date;

  @ApiProperty({ description: "Có thumbnail JPEG hay không" })
  hasThumbnail: boolean;
}
