import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** PATCH một phần; `null` = xóa override trong DB (với Telegram = xóa cấu hình; không đọc env). */
export class UpdateAdminSettingsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2048)
  PUBLIC_APP_URL?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Chat/kênh lưu file chung cho user “dùng chung” (chỉ DB/UI, không env). Ưu tiên trên chat trên admin đầu tiên; bot token trên admin đầu tiên.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(64)
  TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Chat nhận cảnh báo lỗi server — chỉ app_settings.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(64)
  TELEGRAM_ALERT_CHAT_ID?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(64)
  TELEGRAM_SYNC_FOLDER_ID?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(1000)
  SHARE_RATE_LIMIT_TTL_MS?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(1)
  SHARE_RATE_LIMIT_MAX?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(1)
  FOLDER_ZIP_MAX_FILES?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(60)
  FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(1)
  TELEGRAM_DOWNLOAD_MAX_MB?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(1)
  MYSQL_IMPORT_MAX_MB?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsBoolean()
  MYSQL_BACKUP_ENABLED?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(120)
  MYSQL_BACKUP_CRON?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(190)
  MYSQL_BACKUP_FOLDER_NAME?: string | null;
}
