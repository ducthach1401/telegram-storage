import { createReadStream } from 'fs';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InputFile } from 'grammy';
import { TelegramIntegrationMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import { EnvKey } from '../../common/env-keys';
import {
  TELEGRAM_DOCUMENT_THUMB_FILENAME,
  TELEGRAM_FILE_API_BASE,
} from '../telegram.constants';
import { TelegramWebhookPath } from '../storage-http.constants';

interface TelegramFileLike {
  file_id?: string;
  file_unique_id?: string;
  thumbnail?: {
    file_id?: string;
  };
}

interface UploadedTelegramFile {
  fileId: string;
  fileUniqueId: string;
  thumbnailFileId: string | null;
}

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramService.name);
  private bot!: Bot;
  private chatId!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const token = this.config.getOrThrow<string>(EnvKey.TELEGRAM_BOT_TOKEN);
    this.chatId = this.config.getOrThrow<string>(EnvKey.TELEGRAM_STORAGE_CHAT_ID);
    this.bot = new Bot(token);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log('Skipping Telegram webhook setup outside production.');
      return;
    }
    await this.setupWebhookFromEnv();
  }

  private async setupWebhookFromEnv(): Promise<void> {
    const publicAppUrl = this.config
      .get<string>(EnvKey.PUBLIC_APP_URL)
      ?.trim()
      .replace(/\/+$/, '');
    if (!publicAppUrl) {
      this.logger.warn('PUBLIC_APP_URL is empty; skipping Telegram webhook setup.');
      return;
    }

    const webhookUrl = `${publicAppUrl}/${API_V1_PREFIX}/${TelegramWebhookPath}`;
    const secretToken = this.config.get<string>(EnvKey.TELEGRAM_WEBHOOK_SECRET)?.trim();
    try {
      await this.bot.api.setWebhook(webhookUrl, {
        ...(secretToken ? { secret_token: secretToken } : {}),
        allowed_updates: ['message', 'channel_post'],
      });
      this.logger.log(`Telegram webhook set to ${webhookUrl}`);
    } catch (err) {
      this.logger.error('Telegram webhook setup failed', err);
    }
  }

  async uploadDocument(
    buffer: Buffer,
    filename: string,
    thumbnailJpeg?: Buffer,
  ): Promise<{
    messageId: number;
    fileId: string;
    fileUniqueId: string;
    thumbnailFileId: string | null;
  }> {
    const thumb =
      thumbnailJpeg && thumbnailJpeg.length > 0
        ? new InputFile(thumbnailJpeg, TELEGRAM_DOCUMENT_THUMB_FILENAME)
        : undefined;
    const msg = await this.bot.api.sendDocument(this.chatId, new InputFile(buffer, filename), {
      thumbnail: thumb,
      disable_content_type_detection: true,
    });
    const uploaded = TelegramService.extractUploadedFile(msg);
    if (!uploaded) {
      throw new Error(TelegramIntegrationMessage.NO_DOCUMENT_AFTER_SEND);
    }
    return {
      messageId: msg.message_id,
      ...uploaded,
    };
  }

  private static extractUploadedFile(msg: unknown): UploadedTelegramFile | null {
    const m = msg as {
      document?: TelegramFileLike;
      animation?: TelegramFileLike;
      video?: TelegramFileLike;
      sticker?: TelegramFileLike;
      photo?: TelegramFileLike[];
    };
    const file =
      m.document ??
      m.animation ??
      m.video ??
      m.sticker ??
      (Array.isArray(m.photo) ? m.photo.at(-1) : undefined);
    if (!file?.file_id || !file.file_unique_id) {
      return null;
    }
    return {
      fileId: file.file_id,
      fileUniqueId: file.file_unique_id,
      thumbnailFileId: file.thumbnail?.file_id ?? null,
    };
  }

  /** Best-effort: không throw khi tin đã xóa hoặc bot không đủ quyền */
  async deleteChatMessage(messageId: string | number | null | undefined): Promise<void> {
    if (messageId === null || messageId === undefined) return;
    const mid = typeof messageId === 'string' ? Number(messageId) : messageId;
    if (!Number.isFinite(mid)) return;
    try {
      await this.bot.api.deleteMessage(this.chatId, mid);
    } catch {
      /* ignore */
    }
  }

  getBotToken(): string {
    return this.config.getOrThrow<string>(EnvKey.TELEGRAM_BOT_TOKEN);
  }

  async getFileDownloadUrl(fileId: string): Promise<string> {
    const f = await this.bot.api.getFile(fileId);
    if (!f.file_path) {
      throw new Error(TelegramIntegrationMessage.NO_FILE_PATH);
    }
    const token = this.getBotToken();
    return `${TELEGRAM_FILE_API_BASE}${token}/${f.file_path}`;
  }

  /**
   * Kiểm tra `file_id` của document còn được Bot API phục vụ (getFile).
   * Dùng cho reconcile — không throw khi token lỗi; chỉ false.
   */
  async isTelegramDocumentAccessible(fileId: string): Promise<boolean> {
    try {
      const f = await this.bot.api.getFile(fileId);
      return Boolean(f.file_path);
    } catch {
      return false;
    }
  }

  /**
   * Gửi tin nhắn vận hành (lỗi server, queue…). Best-effort — không throw.
   * Chỉ gửi khi env `TELEGRAM_ALERT_CHAT_ID` không rỗng (khác chat lưu file nếu muốn).
   */
  async sendAlertPlainText(text: string): Promise<void> {
    const alertChatId = this.config.get<string>(EnvKey.TELEGRAM_ALERT_CHAT_ID)?.trim();
    if (!alertChatId) {
      return;
    }
    const body = text.length > 4096 ? `${text.slice(0, 4080)}…` : text;
    try {
      await this.bot.api.sendMessage(alertChatId, body);
    } catch (err) {
      console.error('[TelegramService] sendAlertPlainText failed:', err);
    }
  }

  /** Gửi document từ đường dẫn file (stream) — dùng backup MySQL lớn. */
  async sendDocumentFromPath(
    chatId: string,
    absolutePath: string,
    filename: string,
  ): Promise<void> {
    const rs = createReadStream(absolutePath);
    try {
      await this.bot.api.sendDocument(chatId, new InputFile(rs, filename));
    } finally {
      rs.destroy();
    }
  }
}
