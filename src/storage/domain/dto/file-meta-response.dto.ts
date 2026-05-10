import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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

  @ApiPropertyOptional({ type: [String], description: "Tag/label gắn với file" })
  tags?: string[];

  @ApiPropertyOptional({ description: "Có thể tải/xem trực tiếp qua Bot API hay không" })
  canDirectDownload?: boolean;

  @ApiPropertyOptional({ description: "Link message Telegram để mở file trong channel khi file quá lớn" })
  telegramMessageUrl?: string;
}
