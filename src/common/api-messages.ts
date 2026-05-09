/** Thông báo exception / bootstrap — tách khỏi logic để không lặp literal. */

import { EnvKey } from './env-keys';

export const ApiExceptionMessage = {
  PATCH_FILE_NO_CHANGE: 'Cần ít nhất một trong: name, folderId',
  INVALID_PATCH_FOLDER_ID: 'folderId phải là UUID hợp lệ hoặc root',
  FILE_CURSOR_REQUIRES_LIMIT: 'fileCursor chỉ dùng khi có fileLimit',
  MISSING_MULTIPART_FILE: 'Thiếu file (form field `file`)',
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
