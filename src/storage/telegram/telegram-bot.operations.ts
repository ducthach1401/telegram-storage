import { createReadStream } from 'fs';
import { Bot, InputFile } from 'grammy';
import { TelegramIntegrationMessage } from '../../common/api-messages';
import { TELEGRAM_DOCUMENT_THUMB_FILENAME, TELEGRAM_FILE_API_BASE } from '../telegram.constants';

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

function extractUploadedFile(msg: unknown): UploadedTelegramFile | null {
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

export async function telegramUploadDocument(params: {
  token: string;
  chatId: string;
  buffer: Buffer;
  filename: string;
  thumbnailJpeg?: Buffer;
}): Promise<{
  messageId: number;
  fileId: string;
  fileUniqueId: string;
  thumbnailFileId: string | null;
}> {
  const bot = new Bot(params.token.trim());
  const thumb =
    params.thumbnailJpeg && params.thumbnailJpeg.length > 0
      ? new InputFile(params.thumbnailJpeg, TELEGRAM_DOCUMENT_THUMB_FILENAME)
      : undefined;
  const msg = await bot.api.sendDocument(
    params.chatId.trim(),
    new InputFile(params.buffer, params.filename),
    {
      thumbnail: thumb,
      disable_content_type_detection: true,
    },
  );
  const uploaded = extractUploadedFile(msg);
  if (!uploaded) {
    throw new Error(TelegramIntegrationMessage.NO_DOCUMENT_AFTER_SEND);
  }
  return {
    messageId: msg.message_id,
    ...uploaded,
  };
}

export async function telegramDeleteChatMessage(
  token: string,
  chatId: string,
  messageId: string | number | null | undefined,
): Promise<void> {
  if (messageId === null || messageId === undefined) return;
  const mid = typeof messageId === 'string' ? Number(messageId) : messageId;
  if (!Number.isFinite(mid)) return;
  const bot = new Bot(token.trim());
  try {
    await bot.api.deleteMessage(chatId.trim(), mid);
  } catch {
    /* best-effort */
  }
}

export async function telegramGetFileDownloadUrl(
  token: string,
  fileId: string,
): Promise<string> {
  const bot = new Bot(token.trim());
  const f = await bot.api.getFile(fileId);
  if (!f.file_path) {
    throw new Error(TelegramIntegrationMessage.NO_FILE_PATH);
  }
  return `${TELEGRAM_FILE_API_BASE}${token.trim()}/${f.file_path}`;
}

export async function telegramIsDocumentAccessible(
  token: string,
  fileId: string,
): Promise<boolean> {
  try {
    const bot = new Bot(token.trim());
    const f = await bot.api.getFile(fileId);
    return Boolean(f.file_path);
  } catch {
    return false;
  }
}

export async function telegramSendDocumentFromPath(params: {
  token: string;
  chatId: string;
  absolutePath: string;
  filename: string;
}): Promise<void> {
  const bot = new Bot(params.token.trim());
  const rs = createReadStream(params.absolutePath);
  try {
    await bot.api.sendDocument(params.chatId.trim(), new InputFile(rs, params.filename));
  } finally {
    rs.destroy();
  }
}
