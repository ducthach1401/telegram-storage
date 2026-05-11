import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { AccountRole } from '../account-role.enum';

export class PatchAdminAccountDto {
  @ApiPropertyOptional({ enum: AccountRole })
  @IsOptional()
  @IsEnum(AccountRole)
  role?: AccountRole;

  @ApiPropertyOptional({ description: 'Quota MinIO (GB)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minioLimitGb?: number;

  @ApiPropertyOptional({ description: 'true = hoạt động; false = vô hiệu hóa đăng nhập' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
