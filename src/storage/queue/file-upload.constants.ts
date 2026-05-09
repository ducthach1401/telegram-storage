export const FILE_UPLOAD_QUEUE = 'file-upload';

export const FILE_UPLOAD_JOB_NAME = 'persist';

export const BullMqBackoffType = {
  EXPONENTIAL: 'exponential',
} as const;

export const BullMqJobState = {
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const BullMqWorkerEvent = {
  FAILED: 'failed',
} as const;
