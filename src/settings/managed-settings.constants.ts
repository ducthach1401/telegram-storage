import { EnvKey } from '../common/env-keys';

/**
 * Chỉ trong DB (`app_settings`) — không fallback env khi đọc hiệu lực.
 * `TELEGRAM_ALERT_CHAT_ID`: cảnh báo vận hành.
 * `TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID`: chat/kênh lưu chung (UI).
 */
export const TELEGRAM_DB_ONLY_KEYS = [
  EnvKey.TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID,
  EnvKey.TELEGRAM_ALERT_CHAT_ID,
] as const;

/** Các biến có thể sửa qua UI/API (PATCH). */
export const ADMIN_PATCHABLE_KEYS = [
  EnvKey.PUBLIC_APP_URL,
  ...TELEGRAM_DB_ONLY_KEYS,
  EnvKey.TELEGRAM_SYNC_FOLDER_ID,
  EnvKey.UPLOAD_QUEUE_CONCURRENCY,
  EnvKey.UPLOAD_QUEUE_ATTEMPTS,
  EnvKey.UPLOAD_QUEUE_BACKOFF_MS,
  EnvKey.SHARE_RATE_LIMIT_TTL_MS,
  EnvKey.SHARE_RATE_LIMIT_MAX,
  EnvKey.FOLDER_ZIP_MAX_FILES,
  EnvKey.FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS,
  EnvKey.TELEGRAM_DOWNLOAD_MAX_MB,
  EnvKey.MYSQL_IMPORT_MAX_MB,
  EnvKey.MYSQL_BACKUP_ENABLED,
  EnvKey.MYSQL_BACKUP_CRON,
  EnvKey.MYSQL_BACKUP_FOLDER_NAME,
] as const;

export type AdminPatchableKey = (typeof ADMIN_PATCHABLE_KEYS)[number];

/** Tập khóa Cài đặt server — khi đã có dòng DB thì `effectiveRaw` không fallback env. */
export const ADMIN_PATCHABLE_KEY_SET = new Set<string>(ADMIN_PATCHABLE_KEYS);

/** Queue keys do admin UI quản lý trong DB (vẫn cần restart worker để áp dụng fully). */
export const ADMIN_READONLY_QUEUE_KEYS = [
  EnvKey.UPLOAD_QUEUE_CONCURRENCY,
  EnvKey.UPLOAD_QUEUE_ATTEMPTS,
  EnvKey.UPLOAD_QUEUE_BACKOFF_MS,
] as const;
