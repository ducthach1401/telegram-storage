import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvKey } from '../../common/env-keys';
import { StorageService } from '../storage.service';

@Injectable()
export class TelegramSyncService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Đồng bộ ngược: document trong tin/channel đã gửi vào TELEGRAM_STORAGE_CHAT_ID.
   * Bỏ qua tin không có document hoặc đã có telegramMessageId trong DB.
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

    const expected = this.config
      .getOrThrow<string>(EnvKey.TELEGRAM_STORAGE_CHAT_ID)
      .trim();
    if (String(chat.id) !== expected) {
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

    await this.storage.ingestInboundTelegramDocument({
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
