/** Tên biến môi trường — dùng cho ConfigService / process.env, không nhét literal rải rác. */
export const EnvKey = {
  APP_PORT: 'APP_PORT',
  SERVICE_NAME: 'SERVICE_NAME',
  API_BASIC_AUTH_USER: 'API_BASIC_AUTH_USER',
  API_BASIC_AUTH_PASSWORD: 'API_BASIC_AUTH_PASSWORD',
  DOWNLOAD_SHARE_SECRET: 'DOWNLOAD_SHARE_SECRET',
  PUBLIC_APP_URL: 'PUBLIC_APP_URL',
  TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
  TELEGRAM_STORAGE_CHAT_ID: 'TELEGRAM_STORAGE_CHAT_ID',
  /** Chat/channel nhận cảnh báo lỗi (5xx, job queue fail). Để trống = không gửi Telegram. */
  TELEGRAM_ALERT_CHAT_ID: 'TELEGRAM_ALERT_CHAT_ID',
  TELEGRAM_WEBHOOK_SECRET: 'TELEGRAM_WEBHOOK_SECRET',
  /** Thư mục đích khi đồng bộ document từ Telegram vào DB (root hoặc UUID). Để trống = root. */
  TELEGRAM_SYNC_FOLDER_ID: 'TELEGRAM_SYNC_FOLDER_ID',
  SHARE_RATE_LIMIT_TTL_MS: 'SHARE_RATE_LIMIT_TTL_MS',
  SHARE_RATE_LIMIT_MAX: 'SHARE_RATE_LIMIT_MAX',
  /** TTL token tải ZIP async (giây). */
  FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS: 'FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS',
  /** Tối đa số file trong một lần tải ZIP cả thư mục (đệ quy). Mặc định trong code nếu không set. */
  FOLDER_ZIP_MAX_FILES: 'FOLDER_ZIP_MAX_FILES',
  /** Giới hạn file có thể tải lại qua Telegram Bot API getFile. Mặc định 20MB. */
  TELEGRAM_DOWNLOAD_MAX_MB: 'TELEGRAM_DOWNLOAD_MAX_MB',
  MINIO_ENDPOINT: 'MINIO_ENDPOINT',
  MINIO_REGION: 'MINIO_REGION',
  MINIO_ACCESS_KEY: 'MINIO_ACCESS_KEY',
  MINIO_SECRET_KEY: 'MINIO_SECRET_KEY',
  MINIO_BUCKET: 'MINIO_BUCKET',
  MINIO_FORCE_PATH_STYLE: 'MINIO_FORCE_PATH_STYLE',
  MINIO_LIMIT_GB: 'MINIO_LIMIT_GB',
  UPLOAD_TMP_DIR: 'UPLOAD_TMP_DIR',
  UPLOAD_QUEUE_CONCURRENCY: 'UPLOAD_QUEUE_CONCURRENCY',
  UPLOAD_QUEUE_ATTEMPTS: 'UPLOAD_QUEUE_ATTEMPTS',
  UPLOAD_QUEUE_BACKOFF_MS: 'UPLOAD_QUEUE_BACKOFF_MS',
  REDIS_HOST: 'REDIS_HOST',
  REDIS_PORT: 'REDIS_PORT',
  MYSQL_HOST: 'MYSQL_HOST',
  MYSQL_PORT: 'MYSQL_PORT',
  MYSQL_USER: 'MYSQL_USER',
  MYSQL_PASSWORD: 'MYSQL_PASSWORD',
  MYSQL_DATABASE: 'MYSQL_DATABASE',
  /** Giới hạn kích thước file upload import SQL (MB). Mặc định 512 trong code nếu không set. */
  MYSQL_IMPORT_MAX_MB: 'MYSQL_IMPORT_MAX_MB',
  TYPEORM_SYNCHRONIZE: 'TYPEORM_SYNCHRONIZE',
  /** `true` — đăng ký cron dump MySQL + gửi file `.sql.gz` lên Telegram. */
  MYSQL_BACKUP_ENABLED: 'MYSQL_BACKUP_ENABLED',
  /** Cron biểu thức (vd `0 3 * * 0` = mỗi Chủ nhật 03:00 server). */
  MYSQL_BACKUP_CRON: 'MYSQL_BACKUP_CRON',
  /** Tên thư mục con dưới gốc để lưu file backup (.sql.gz); mặc định trong code `backup` nếu không set. */
  MYSQL_BACKUP_FOLDER_NAME: 'MYSQL_BACKUP_FOLDER_NAME',
} as const;
