import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShareDownloadLinkResponseDto {
  @ApiProperty({ description: 'Token ký HMAC — cũng nằm trong URL query' })
  token: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({
    description: 'Đường dẫn tương đối download (?token=…)',
    example: '/api/v1/shared/files/download?token=…',
  })
  downloadPath: string;

  @ApiProperty({
    description: 'Đường dẫn tương đối xem inline',
    example: '/api/v1/shared/files/view?token=…',
  })
  viewPath: string;

  @ApiPropertyOptional({
    description: 'URL đầy đủ khi đã cấu hình PUBLIC_APP_URL (admin Settings / runtime)',
  })
  downloadUrl?: string;

  @ApiPropertyOptional()
  viewUrl?: string;
}
