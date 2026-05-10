/** File ≥ 20MB đi MinIO — không có quota MinIO account thì chỉ cho đến mức này. */
export const TELEGRAM_ONLY_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Giới hạn multipart tối đa — chỉ theo quota MinIO của account (`minioLimitGb`), không có trần server.
 * Account quota = 0 → tối đa ~20MB (Telegram-only).
 */
export function multerMaxFileBytesForAccount(accountMinioLimitGb: number): number {
  const userGb =
    Number.isFinite(accountMinioLimitGb) && accountMinioLimitGb > 0 ? accountMinioLimitGb : 0;
  const userCap = Math.floor(userGb * 1024 * 1024 * 1024);
  return Math.max(TELEGRAM_ONLY_UPLOAD_MAX_BYTES, userCap);
}
