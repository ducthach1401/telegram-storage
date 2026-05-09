import { ApiProperty } from "@nestjs/swagger";

/** Kết quả thư mục (không kèm quan hệ con — tránh schema vòng) */
export class FolderResponseDto {
  @ApiProperty({ format: "uuid", example: "00000000-0000-4000-8000-000000000001" })
  id: string;

  @ApiProperty({
    format: "uuid",
    nullable: true,
    description: "Thư mục cha; null = Root ảo",
  })
  parentId: string | null;

  @ApiProperty({ example: "Ảnh 2025" })
  name: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: Date;
}
