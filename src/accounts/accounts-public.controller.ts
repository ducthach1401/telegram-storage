import {
  Body,
  Controller,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Account } from './account.entity';
import { CurrentAccount } from './current-account.decorator';
import { API_V1_PREFIX } from '../common/api-route';
import { Public } from '../auth/public.decorator';
import { AccountService } from './account.service';
import { PatchSelfTelegramDto } from './dto/patch-self-telegram.dto';
import { RegisterAccountDto } from './dto/register-account.dto';
import { TelegramService } from '../storage/telegram/telegram.service';

@ApiTags('auth')
@Controller(API_V1_PREFIX)
export class AccountsPublicController {
  constructor(
    private readonly accounts: AccountService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
  ) {}

  @Public()
  @Get('auth/setup-status')
  @ApiOperation({
    summary: 'Trạng thái khởi tạo (chưa có tài khoản trong DB)',
    description:
      '`needsFirstAdmin: true` khi chưa có dòng nào trong `accounts` — UI chỉ nên cho đăng ký admin đầu tiên, không đăng nhập.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        needsFirstAdmin: { type: 'boolean', example: true },
      },
    },
  })
  async setupStatus(): Promise<{ needsFirstAdmin: boolean }> {
    const count = await this.accounts.countAccounts();
    return { needsFirstAdmin: count === 0 };
  }

  @Public()
  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Đăng ký tài khoản',
    description:
      'Tài khoản **đầu tiên** trong DB trở thành **admin** (quota MinIO như bootstrap): bắt buộc bot token, chat lưu file, `publicAppUrl` (PUBLIC_APP_URL) và `telegramStorageChatForPublicId` (chat/kênh lưu chung); `telegramAlertChatId` (TELEGRAM_ALERT_CHAT_ID) tuỳ chọn. Các tài khoản sau là user (quota 0), theo quy tắc Telegram như mô tả.',
  })
  @ApiCreatedResponse({
    description: 'Đã tạo account',
    schema: {
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        role: { type: 'string' },
        minioLimitGb: { type: 'number' },
      },
    },
  })
  async register(@Body() dto: RegisterAccountDto) {
    const acc = await this.accounts.registerUser({
      username: dto.username,
      password: dto.password,
      usePlatformTelegramStorage: dto.usePlatformTelegramStorage,
      telegramBotToken: dto.telegramBotToken,
      telegramStorageChatId: dto.telegramStorageChatId,
      telegramStorageChatForPublicId: dto.telegramStorageChatForPublicId,
      publicAppUrl: dto.publicAppUrl,
      telegramAlertChatId: dto.telegramAlertChatId,
    });
    return {
      id: acc.id,
      username: acc.username,
      role: acc.role,
      minioLimitGb: acc.minioLimitGb,
    };
  }

  @Patch('auth/me/telegram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật bot Telegram và chat lưu file của chính user đăng nhập' })
  @ApiOkResponse()
  async patchSelfTelegram(
    @CurrentAccount() account: Account,
    @Body() dto: PatchSelfTelegramDto,
  ): Promise<{
    telegramUsePlatformDefaults: boolean;
    telegramStorageChatId: string;
    hasTelegramBotToken: boolean;
  }> {
    const acc = await this.accounts.patchSelfTelegram(account.id, {
      usePlatformTelegramStorage: dto.usePlatformTelegramStorage,
      telegramBotToken: dto.telegramBotToken,
      telegramStorageChatId: dto.telegramStorageChatId,
    });
    if (this.accounts.isPrimaryAdminSync(account.id)) {
      await this.telegram.refreshWebhookIfConfigured();
    }
    return {
      telegramUsePlatformDefaults: acc.telegramUsePlatformDefaults,
      telegramStorageChatId: acc.telegramStorageChatId ?? '',
      hasTelegramBotToken: Boolean(acc.telegramBotToken?.trim()),
    };
  }
}
