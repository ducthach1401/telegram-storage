import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../auth/public.decorator';
import { ApiExceptionMessage } from '../../common/api-messages';
import { EnvKey } from '../../common/env-keys';
import { API_V1_PREFIX } from '../../common/api-route';
import { TelegramWebhookPath } from '../storage-http.constants';
import { TelegramSyncService } from './telegram-sync.service';

@ApiTags('telegram')
@Public()
@Controller(`${API_V1_PREFIX}`)
export class TelegramWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly sync: TelegramSyncService,
  ) {}

  @Post(TelegramWebhookPath)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook Telegram (đồng bộ ngược document vào DB)',
    description:
      'Đặt URL này trong BotFather / `setWebhook`. Tuỳ chọn header `X-Telegram-Bot-Api-Secret-Token` khớp `TELEGRAM_WEBHOOK_SECRET`. Chỉ xử lý tin từ chat `TELEGRAM_STORAGE_CHAT_ID`.',
    security: [],
  })
  @ApiUnauthorizedResponse({ description: 'TELEGRAM_WEBHOOK_SECRET không khớp' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
  })
  async webhook(
    @Req() req: Request,
    @Body() update: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    const secret = this.config.get<string>(EnvKey.TELEGRAM_WEBHOOK_SECRET)?.trim();
    if (secret) {
      const token = req.headers['x-telegram-bot-api-secret-token'];
      if (typeof token !== 'string' || token !== secret) {
        throw new UnauthorizedException(ApiExceptionMessage.WEBHOOK_SECRET_INVALID);
      }
    }

    await this.sync.handleTelegramUpdate(update);
    return { ok: true };
  }
}
