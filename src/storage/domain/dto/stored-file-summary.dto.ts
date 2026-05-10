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

  @ApiProperty({ nullable: true, description: "Telegram Bot API file_id" })
  telegramFileId: string | null;

  @ApiProperty({ nullable: true })
  telegramFileUniqueId: string | null;

  @ApiPropertyOptional({ nullable: true, description: "SHA-256 của nội dung file" })
  contentSha256?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Bucket MinIO/S3 nếu file có bản lưu S3" })
  s3Bucket?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Object key MinIO/S3 nếu file có bản lưu S3" })
  s3ObjectKey?: string | null;

  @ApiProperty({ nullable: true })
  thumbnailTelegramFileId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Telegram message_id — có sau upload (để xóa tin nhắn)",
  })
  telegramMessageId: string | null;

  @ApiPropertyOptional({ type: [String], description: "Tag/label gắn với file" })
  tags?: string[];

  @ApiPropertyOptional({ description: "Có thể tải/xem trực tiếp qua Bot API hay không" })
  canDirectDownload?: boolean;

  @ApiPropertyOptional({ description: "Link message Telegram để mở file trong channel khi file quá lớn" })
  telegramMessageUrl?: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: Date;
}
