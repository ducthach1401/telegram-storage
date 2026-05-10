import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class PatchSelfTelegramDto {
  @ApiProperty({
    description:
      'true = dùng bot/kênh từ Cài đặt server (app_settings); false = token + chat riêng.',
    default: true,
  })
  @Transform(({ value }) => (value === undefined ? true : Boolean(value)))
  @IsBoolean()
  usePlatformTelegramStorage!: boolean;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.usePlatformTelegramStorage === false)
  @IsOptional()
  @IsString()
  @MaxLength(512)
  /** Để trống = giữ token đã lưu (khi đã có). */
  telegramBotToken?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.usePlatformTelegramStorage === false)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  /** Để trống = giữ chat ID đã lưu (khi đã có). */
  telegramStorageChatId?: string;
}
