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
} as const;

export const AdminQueueSubRoute = {
  STATS: 'stats',
  JOBS: 'jobs',
  WORKERS: 'workers',
} as const;

export const AdminReconcileSubRoute = {
  FILES: 'files',
} as const;
