import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FolderZipAutoResponseDto {
  @ApiProperty({ enum: ['direct', 'queue'] })
  mode: 'direct' | 'queue';

  @ApiProperty()
  fileCount: number;

  @ApiProperty()
  zipBaseName: string;

  @ApiPropertyOptional()
  downloadPath?: string;

  @ApiPropertyOptional()
  jobId?: string;
}
