/** Segment đường dẫn REST admin (kết hợp `API_V1_PREFIX`). */

export const AdminControllerPath = {
  QUEUE: 'admin/queue',
  RECONCILE: 'admin/reconcile',
  FILES: 'admin/files',
  MYSQL: 'admin/mysql',
} as const;

export const AdminMysqlSubRoute = {
  IMPORT: 'import',
} as const;

export const AdminFilesSubRoute = {
  DUPLICATES: 'duplicates',
  DELETE_DUPLICATES: 'duplicates/delete',
} as const;

export const AdminQueueSubRoute = {
  STATS: 'stats',
  JOBS: 'jobs',
  RETRY_FAILED: 'jobs/failed/retry',
  RETRY_JOB: 'jobs/:jobId/retry',
  DELETE_JOB: 'jobs/:jobId',
  WORKERS: 'workers',
} as const;

export const AdminReconcileSubRoute = {
  FILES: 'files',
} as const;
