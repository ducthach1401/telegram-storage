import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateAccountQuotaDto {
  @ApiProperty({ description: 'Quota MinIO (GB)', example: 10 })
  @IsNumber()
  minioLimitGb!: number;
}
