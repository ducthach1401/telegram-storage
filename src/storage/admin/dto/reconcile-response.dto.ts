import { ApiProperty } from '@nestjs/swagger';

export class ReconcileResponseDto {
  @ApiProperty({ description: 'Số bản ghi đã gọi getFile kiểm tra' })
  scanned: number;

  @ApiProperty({
    description: 'Số file DB mà Telegram không còn phục vụ file_id (document)',
  })
  staleFound: number;

  @ApiProperty({
    description: 'Đã xóa khỏi DB (+ best-effort deleteMessage); 0 khi dryRun',
  })
  removedFromDb: number;

  @ApiProperty()
  dryRun: boolean;
}
