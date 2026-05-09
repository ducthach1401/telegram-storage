import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** Bản ghi file trong danh sách thư mục */
export class StoredFileSummaryDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  folderId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: "image/jpeg" })
  mimeType: string;

  @ApiProperty({ example: 102400 })
  size: number;

  @ApiProperty({ description: "Telegram Bot API file_id" })
  telegramFileId: string;

  @ApiProperty()
  telegramFileUniqueId: string;

  @ApiProperty({ nullable: true })
  thumbnailTelegramFileId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Telegram message_id — có sau upload (để xóa tin nhắn)",
  })
  telegramMessageId: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: Date;
}
