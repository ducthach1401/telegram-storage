/** Thông báo exception / bootstrap — tách khỏi logic để không lặp literal. */

import { EnvKey } from './env-keys';

export const ApiExceptionMessage = {
  MISSING_DOWNLOAD_SHARE_SECRET:
    'Thiếu hoặc rỗng DOWNLOAD_SHARE_SECRET — cần secret để ký link tải chia sẻ',
  SHARE_TOKEN_INVALID: 'Token tải không hợp lệ hoặc đã hết hạn',
  PATCH_FILE_NO_CHANGE: 'Cần ít nhất một trong: name, folderId',
  INVALID_PATCH_FOLDER_ID: 'folderId phải là UUID hợp lệ hoặc root',
  FILE_CURSOR_REQUIRES_LIMIT: 'fileCursor chỉ dùng khi có fileLimit',
  FOLDER_CURSOR_REQUIRES_LIMIT: 'folderCursor chỉ dùng khi có folderLimit',
  FOLDER_ZIP_TOO_MANY_FILES:
    'Quá nhiều file trong thư mục (kể cả con cháu) để đóng gói ZIP — giảm phạm vi hoặc tăng FOLDER_ZIP_MAX_FILES',
  FOLDER_COPY_ROOT_FORBIDDEN: 'Không sao chép được thư mục gốc (root) toàn bộ drive',
  FOLDER_COPY_TARGET_INSIDE_SOURCE:
    'Không được sao chép thư mục vào chính thư mục đó hoặc vào thư mục con bên trong',
  WEBHOOK_SECRET_INVALID: 'Secret webhook Telegram không khớp',
  META_BATCH_TOO_MANY_IDS: 'Quá nhiều id trong batch — giảm số lượng',
  FOLDER_ZIP_JOB_NOT_READY: 'Job ZIP chưa hoàn thành hoặc không có kết quả',
  MISSING_MULTIPART_FILE: 'Thiếu file (form field `file`)',
  MYSQL_IMPORT_FAILED:
    'Import MySQL thất bại — kiểm tra file SQL/gzip và stderr trong response',
  QUEUE_JOB_CREATE_FAILED: 'Không tạo được job trên queue',
  JOB_NOT_FOUND: 'Không tìm thấy job',
  FILE_NO_THUMBNAIL: 'File không có thumbnail',
  TELEGRAM_THUMB_DOWNLOAD_FAILED: 'Không tải được thumbnail từ Telegram',
  TELEGRAM_FILE_DOWNLOAD_FAILED: 'Không tải được file từ Telegram',
  FOLDER_ID_INVALID: 'folderId phải là "root" hoặc UUID hợp lệ',
  BASIC_AUTH_REQUIRED: 'Yêu cầu Basic Authorization',
  MISSING_BASIC_AUTH_USER: `Thiếu hoặc rỗng ${EnvKey.API_BASIC_AUTH_USER} — xem .env.example và file .env`,
  MISSING_BASIC_AUTH_PASSWORD: `Thiếu hoặc rỗng ${EnvKey.API_BASIC_AUTH_PASSWORD} — xem .env.example và file .env`,
} as const;

export const StorageExceptionMessage = {
  FOLDER_NOT_FOUND: 'Không tìm thấy thư mục',
  FOLDER_NAME_EMPTY: 'Tên thư mục không được để trống',
  FOLDER_DUPLICATE_NAME: 'Đã có thư mục cùng tên trong thư mục cha',
  FILE_DUPLICATE_NAME: 'Đã có file cùng tên trong thư mục',
  FILE_SUFFIX_EXHAUSTED:
    'Không tìm được tên trống sau khi thử hậu tố (1), (2), … — đổi tên gốc hoặc xóa file trùng',
  ROOT_FOLDER_DELETE_FORBIDDEN: 'Không được xóa thư mục gốc',
  FILE_NOT_FOUND: 'Không tìm thấy file',
} as const;

export const TelegramIntegrationMessage = {
  NO_DOCUMENT_AFTER_SEND: 'Telegram không trả về document sau khi gửi',
  NO_FILE_PATH: 'Không lấy được file_path từ Telegram',
} as const;
