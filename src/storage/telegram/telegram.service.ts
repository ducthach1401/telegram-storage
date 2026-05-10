import { createReadStream } from 'fs';
import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InputFile } from 'grammy';
import { AccountService } from '../../accounts/account.service';
import { TelegramIntegrationMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import { EnvKey } from '../../common/env-keys';
import {
  TELEGRAM_DOCUMENT_THUMB_FILENAME,
  TELEGRAM_FILE_API_BASE,
} from '../telegram.constants';
import { TelegramWebhookPath } from '../storage-http.constants';
import { RuntimeConfigService } from '../../settings/runtime-config.service';

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
  private bot: Bot | null = null;
  private lastSyncedToken = '';

  constructor(
    private readonly config: ConfigService,
    private readonly runtime: RuntimeConfigService,
    @Inject(forwardRef(() => AccountService))
    private readonly accounts: AccountService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      'Telegram bot + kênh lưu mặc định/webhook lấy từ tài khoản admin đầu tiên (bot token + chat lưu file trong DB).',
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log('Skipping Telegram webhook setup outside production.');
      return;
    }
    await this.configureWebhook();
  }

  /** Đồng bộ Bot với token trên tài khoản admin đầu tiên; false nếu chưa đủ. */
  private syncBotFromPrimaryAdmin(): boolean {
    const d = this.accounts.getPlatformTelegramMergeDefaultsSync();
    const token = d?.telegramBotToken ?? '';
    if (!token) {
      this.bot = null;
      this.lastSyncedToken = '';
      return false;
    }
    if (this.bot && this.lastSyncedToken === token) {
      return true;
    }
    this.bot = new Bot(token);
    this.lastSyncedToken = token;
    return true;
  }

  private requireBotAndMainStorageChat(): { bot: Bot; chatId: string } {
    const d = this.accounts.getPlatformTelegramMergeDefaultsSync();
    const chatId = (d?.telegramStorageChatId ?? '').trim();
    if (!chatId || !this.syncBotFromPrimaryAdmin()) {
      throw new Error(
        'Admin đầu tiên chưa cấu đủ bot token và chat lưu file trên tài khoản của họ.',
      );
    }
    return { bot: this.bot!, chatId };
  }

  /** Gọi sau khi đổi PUBLIC_APP_URL hoặc bot token của admin đầu tiên (production). */
  async refreshWebhookIfConfigured(): Promise<{
    applied: boolean;
    skippedReason?: string;
  }> {
    if (process.env.NODE_ENV !== 'production') {
      return { applied: false, skippedReason: 'non-production' };
    }
    const ok = await this.configureWebhook();
    return ok
      ? { applied: true }
      : { applied: false, skippedReason: 'setWebhook failed — xem log server' };
  }

  /** @returns false khi bỏ qua hoặc Telegram API lỗi */
  private async configureWebhook(): Promise<boolean> {
    if (!this.syncBotFromPrimaryAdmin()) {
      this.logger.warn(
        'Admin đầu tiên chưa có bot token + chat lưu file; bỏ qua đặt Telegram webhook.',
      );
      return false;
    }
    const publicAppUrl = this.runtime
      .effectiveTrimmed(EnvKey.PUBLIC_APP_URL)
      ?.replace(/\/+$/, '');
    if (!publicAppUrl) {
      this.logger.warn('PUBLIC_APP_URL is empty; skipping Telegram webhook setup.');
      return false;
    }

    const webhookUrl = `${publicAppUrl}/${API_V1_PREFIX}/${TelegramWebhookPath}`;
    const secretToken = this.config.get<string>(EnvKey.TELEGRAM_WEBHOOK_SECRET)?.trim();
    try {
      await this.bot!.api.setWebhook(webhookUrl, {
        ...(secretToken ? { secret_token: secretToken } : {}),
        allowed_updates: ['message', 'channel_post'],
      });
      this.logger.log(`Telegram webhook set to ${webhookUrl}`);
      return true;
    } catch (err) {
      this.logger.error('Telegram webhook setup failed', err);
      return false;
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
    const { bot, chatId } = this.requireBotAndMainStorageChat();
    const thumb =
      thumbnailJpeg && thumbnailJpeg.length > 0
        ? new InputFile(thumbnailJpeg, TELEGRAM_DOCUMENT_THUMB_FILENAME)
        : undefined;
    const msg = await bot.api.sendDocument(chatId, new InputFile(buffer, filename), {
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

  getBotToken(): string {
    return this.accounts.getPlatformTelegramMergeDefaultsSync()?.telegramBotToken ?? '';
  }

  async getFileDownloadUrl(fileId: string): Promise<string> {
    if (!this.syncBotFromPrimaryAdmin()) {
      throw new Error(TelegramIntegrationMessage.NO_FILE_PATH);
    }
    const f = await this.bot!.api.getFile(fileId);
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
    if (!this.syncBotFromPrimaryAdmin()) {
      return false;
    }
    try {
      const f = await this.bot!.api.getFile(fileId);
      return Boolean(f.file_path);
    } catch {
      return false;
    }
  }

  /**
   * Gửi tin nhắn vận hành (lỗi server, queue…). Best-effort — không throw.
   * Chat lấy từ `TELEGRAM_ALERT_CHAT_ID` trong app_settings.
   */
  async sendAlertPlainText(text: string): Promise<void> {
    if (!this.syncBotFromPrimaryAdmin()) {
      return;
    }
    const alertChatId = this.runtime.effectiveTrimmed(EnvKey.TELEGRAM_ALERT_CHAT_ID);
    if (!alertChatId) {
      return;
    }
    const body = text.length > 4096 ? `${text.slice(0, 4080)}…` : text;
    try {
      await this.bot!.api.sendMessage(alertChatId, body);
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
    if (!this.syncBotFromPrimaryAdmin()) {
      throw new Error(
        'Admin đầu tiên chưa cấu đủ bot token và chat lưu file trên tài khoản của họ.',
      );
    }
    const rs = createReadStream(absolutePath);
    try {
      await this.bot!.api.sendDocument(chatId, new InputFile(rs, filename));
    } finally {
      rs.destroy();
    }
  }
}
