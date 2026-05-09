import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { DUPLICATE_NAME_POLICIES } from '../duplicate-name-policy';

export class DuplicatePolicyQueryDto {
  @ApiPropertyOptional({
    enum: DUPLICATE_NAME_POLICIES,
    description: 'reject = 409 khi trùng tên; overwrite = xóa bản ghi cũ + Telegram; suffix = "tên (1).ext"',
  })
  @IsOptional()
  @IsIn([...DUPLICATE_NAME_POLICIES])
  duplicatePolicy?: string;

  @ApiPropertyOptional({
    description: 'Tương đương duplicatePolicy=overwrite',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  overwrite?: boolean;
}
