import { BadRequestException } from '@nestjs/common';
import type { Account } from './account.entity';
import type { StorageTenant } from '../storage/domain/storage-tenant';

export function storageTenantFromAccount(
  account: Account,
  platformTelegram?: { telegramBotToken: string; telegramStorageChatId: string } | null,
): StorageTenant {
  if (account.telegramUsePlatformDefaults && platformTelegram) {
    return {
      accountId: account.id,
      rootFolderId: account.rootFolderId,
      telegramBotToken: platformTelegram.telegramBotToken.trim(),
      telegramStorageChatId: platformTelegram.telegramStorageChatId.trim(),
      minioLimitGb: Number(account.minioLimitGb) || 0,
    };
  }
  const telegramBotToken = (account.telegramBotToken ?? '').trim();
  const telegramStorageChatId = (account.telegramStorageChatId ?? '').trim();
  return {
    accountId: account.id,
    rootFolderId: account.rootFolderId,
    telegramBotToken,
    telegramStorageChatId,
    minioLimitGb: Number(account.minioLimitGb) || 0,
  };
}

export function assertTenantTelegramConfigured(t: StorageTenant): void {
  if (!t.telegramBotToken || !t.telegramStorageChatId) {
    throw new BadRequestException(
      'Thiếu cấu hình Telegram cho tài khoản (bot token / kênh lưu hoặc Cài đặt admin cho chế độ server) — không thể upload.',
    );
  }
}
