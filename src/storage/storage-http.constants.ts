/** Route segment / form field — đồng bộ controller và multipart. */

export const FileMultipart = {
  FIELD_FILE: 'file',
  BODY_FOLDER_ID: 'folderId',
} as const;

export const FileRoutePath = {
  QUOTA: 'quota',
  TRASH: 'trash',
  SEARCH: 'search',
  UPLOAD: 'upload',
  UPLOAD_ASYNC: 'upload/async',
  UPLOAD_JOB_STATUS: 'upload/jobs/:jobId',
} as const;

export const FileRouteParam = {
  JOB_ID: 'jobId',
} as const;

export const FileRoutePathSegment = {
  SHARE_DOWNLOAD: 'share-download',
} as const;

export const SharedFilesRoutePath = {
  BASE: 'shared/files',
  DOWNLOAD: 'download',
  VIEW: 'view',
} as const;

export const SharedFilesQuery = {
  TOKEN: 'token',
} as const;

export const FolderRoutePath = {
  PARAM_FOLDER_ID: 'folderId',
  CONTENTS_PATH: ':folderId/contents',
  /** ZIP đệ quy: mọi file trong thư mục và thư mục con */
  DOWNLOAD_ZIP_PATH: ':folderId/download',
  DOWNLOAD_ZIP_AUTO_PATH: ':folderId/download/auto',
  DOWNLOAD_ZIP_ASYNC_PATH: ':folderId/download/async',
  DOWNLOAD_JOB_STATUS_PATH: 'download/jobs/:jobId',
  DOWNLOAD_STREAM_PATH: 'download/stream',
  COPY_FOLDER_PATH: ':folderId/copy',
  SINGLE_FOLDER: ':folderId',
} as const;

export const FolderZipRouteQuery = {
  TOKEN: 'token',
} as const;

export const TelegramWebhookPath = 'telegram/webhook' as const;
