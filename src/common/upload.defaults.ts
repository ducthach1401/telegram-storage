import { EnvKey } from './env-keys';

/** Giá trị mặc định khi env không set (upload size / concurrency). */
export const UploadDefaults = {
  /** Quota MinIO (GB) cho admin đầu tiên khi bootstrap DB — không phải trần server. */
  BOOTSTRAP_ADMIN_MINIO_GB: 50,
  TELEGRAM_DOWNLOAD_MAX_MB_FALLBACK: 20,
  QUEUE_CONCURRENCY_FALLBACK: 3,
  QUEUE_ATTEMPTS_FALLBACK: 5,
  QUEUE_BACKOFF_MS_FALLBACK: 4000,
} as const;

export function telegramDownloadMaxBytes(): number {
  const mb = Number(
    process.env[EnvKey.TELEGRAM_DOWNLOAD_MAX_MB] ??
      String(UploadDefaults.TELEGRAM_DOWNLOAD_MAX_MB_FALLBACK),
  );
  return Math.max(1, Math.floor(Number.isFinite(mb) ? mb : UploadDefaults.TELEGRAM_DOWNLOAD_MAX_MB_FALLBACK)) *
    1024 *
    1024;
}
