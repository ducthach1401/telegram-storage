export const TELEGRAM_DOCUMENT_THUMB_FILENAME = 'thumb.jpg';

export const TELEGRAM_FILE_API_BASE = 'https://api.telegram.org/file/bot';

/** Link mở tin public trên t.me (supergroup/channel `-100…` hoặc `@username`). */
export function telegramPublicMessageUrl(
  messageId: string | null | undefined,
  storageChatId?: string | null,
): string | undefined {
  if (!messageId) {
    return undefined;
  }
  const chat = (storageChatId ?? '').trim();
  if (!chat) {
    return undefined;
  }
  if (chat.startsWith('@')) {
    return `https://t.me/${chat.slice(1)}/${messageId}`;
  }
  if (chat.startsWith('-100')) {
    return `https://t.me/c/${chat.slice(4)}/${messageId}`;
  }
  return undefined;
}
