import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AccountRole } from '../account-role.enum';

export class CreateAccountAdminDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ enum: AccountRole })
  @IsEnum(AccountRole)
  role!: AccountRole;

  @ApiProperty({ description: 'Quota MinIO (GB). User thường mặc định 0.', example: 0 })
  @IsNumber()
  minioLimitGb!: number;

  @ApiProperty({
    required: false,
    description:
      'true — account dùng bot/kênh chung server (bỏ qua telegramBotToken / telegramStorageChatId trong body).',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  telegramUsePlatformDefaults?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telegramBotToken?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telegramStorageChatId?: string | null;
}
