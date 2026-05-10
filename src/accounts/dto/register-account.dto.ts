import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
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
      'true (mặc định) = dùng bot và kênh lưu chung trên server; false = nhập telegramBotToken + telegramStorageChatId.',
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
}
