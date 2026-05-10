import { Injectable } from '@nestjs/common';
import { AccountService } from '../../accounts/account.service';
import { StorageService } from '../storage.service';

@Injectable()
export class TelegramSyncService {
  constructor(
    private readonly accounts: AccountService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Đồng bộ ngược: khớp `telegram_storage_chat_id` trên account, hoặc khớp `TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID`
   * (Cài đặt server) → gán ingest cho admin đầu tiên.
   */
  async handleTelegramUpdate(update: Record<string, unknown>): Promise<void> {
    const msgRaw =
      (update.message as Record<string, unknown> | undefined) ??
      (update.channel_post as Record<string, unknown> | undefined);
    if (!msgRaw || typeof msgRaw !== 'object') {
      return;
    }

    const chat = msgRaw.chat as { id?: number | string } | undefined;
    if (!chat || chat.id === undefined) {
      return;
    }

    const chatIdStr = String(chat.id);
    const account = await this.accounts.findByTelegramStorageChatId(chatIdStr);
    if (!account) {
      return;
    }

    const doc = msgRaw.document as
      | {
          file_id?: string;
          file_unique_id?: string;
          file_name?: string;
          mime_type?: string;
          file_size?: number;
          thumbnail?: { file_id?: string };
        }
      | undefined;
    if (
      !doc?.file_id ||
      !doc.file_unique_id ||
      typeof msgRaw.message_id !== 'number'
    ) {
      return;
    }

    const tenant = this.storage.storageTenantFromAccountEntity(account);
    await this.storage.ingestInboundTelegramDocument(tenant, {
      messageId: msgRaw.message_id,
      document: {
        file_id: doc.file_id,
        file_unique_id: doc.file_unique_id,
        file_name: doc.file_name,
        mime_type: doc.mime_type,
        file_size: doc.file_size,
      },
      thumbnailFileId: doc.thumbnail?.file_id ?? null,
    });
  }
}
