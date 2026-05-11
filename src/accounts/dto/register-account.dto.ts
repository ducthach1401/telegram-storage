import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterAccountDto {
  @ApiProperty({ example: 'alice' })
  @IsString()
  @MinLength(2)
  username!: string;

  @ApiProperty({ example: 'secret12' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({
    description:
      'true (mặc định) = dùng bot và kênh lưu chung với hệ thống; false = nhập telegramBotToken + telegramStorageChatId.',
    default: true,
  })
  @Transform(({ value }) => (value === undefined ? true : Boolean(value)))
  @IsBoolean()
  usePlatformTelegramStorage!: boolean;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.usePlatformTelegramStorage === false)
  @IsString()
  @IsNotEmpty()
  telegramBotToken?: string;

  @ApiProperty({
    required: false,
    description: 'Chat/channel ID khi usePlatformTelegramStorage = false',
  })
  @ValidateIf((o) => o.usePlatformTelegramStorage === false)
  @IsString()
  @IsNotEmpty()
  telegramStorageChatId?: string;

  @ApiProperty({
    required: false,
    description:
      'Chat/kênh lưu chung (TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID) — bắt buộc khi đăng ký admin đầu tiên.',
  })
  @IsString()
  @IsOptional()
  telegramStorageChatForPublicId?: string;

  @ApiProperty({
    required: false,
    description:
      'URL gốc (PUBLIC_APP_URL) — bắt buộc khi đăng ký admin đầu tiên; UI thường gửi `location.origin`.',
  })
  @IsString()
  @IsOptional()
  publicAppUrl?: string;

  @ApiProperty({
    required: false,
    description:
      'Chat cảnh báo (TELEGRAM_ALERT_CHAT_ID) — tuỳ chọn khi đăng ký admin đầu tiên.',
  })
  @IsString()
  @IsOptional()
  telegramAlertChatId?: string;
}
