/** Segment đường dẫn REST admin (kết hợp `API_V1_PREFIX`). */

export const AdminControllerPath = {
  QUEUE: 'admin/queue',
  RECONCILE: 'admin/reconcile',
} as const;

export const AdminQueueSubRoute = {
  STATS: 'stats',
  JOBS: 'jobs',
  WORKERS: 'workers',
} as const;

export const AdminReconcileSubRoute = {
  FILES: 'files',
} as const;
