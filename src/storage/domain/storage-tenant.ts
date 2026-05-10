/** Ngữ cảnh tenant cho StorageService (theo account đăng nhập). */
export interface StorageTenant {
  accountId: string;
  rootFolderId: string;
  telegramBotToken: string;
  telegramStorageChatId: string;
  /** GB — 0 = không dùng MinIO cho file ≥ 20MB */
  minioLimitGb: number;
}
