import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InputFile } from 'grammy';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot!: Bot;
  private chatId!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.config.getOrThrow<string>('TELEGRAM_STORAGE_CHAT_ID');
    this.bot = new Bot(token);
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
        ? new InputFile(thumbnailJpeg, 'thumb.jpg')
        : undefined;
    const msg = await this.bot.api.sendDocument(this.chatId, new InputFile(buffer, filename), {
      thumbnail: thumb,
    });
    const doc = msg.document;
    if (!doc) {
      throw new Error('Telegram không trả về document sau khi gửi');
    }
    return {
      messageId: msg.message_id,
      fileId: doc.file_id,
      fileUniqueId: doc.file_unique_id,
      thumbnailFileId: doc.thumbnail?.file_id ?? null,
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
    return this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
  }

  async getFileDownloadUrl(fileId: string): Promise<string> {
    const f = await this.bot.api.getFile(fileId);
    if (!f.file_path) {
      throw new Error('Không lấy được file_path từ Telegram');
    }
    const token = this.getBotToken();
    return `https://api.telegram.org/file/bot${token}/${f.file_path}`;
  }
}
