/** Route segment / form field — đồng bộ controller và multipart. */

export const FileMultipart = {
  FIELD_FILE: 'file',
  BODY_FOLDER_ID: 'folderId',
} as const;

export const FileRoutePath = {
  SEARCH: 'search',
  UPLOAD: 'upload',
  UPLOAD_ASYNC: 'upload/async',
  UPLOAD_JOB_STATUS: 'upload/jobs/:jobId',
} as const;

export const FileRouteParam = {
  JOB_ID: 'jobId',
} as const;

export const FolderRoutePath = {
  PARAM_FOLDER_ID: 'folderId',
  CONTENTS_PATH: ':folderId/contents',
  SINGLE_FOLDER: ':folderId',
} as const;
