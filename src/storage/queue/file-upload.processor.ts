import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { readFile, unlink } from 'fs/promises';
import { StoredFile } from '../domain/entities/stored-file.entity';
import { StorageService } from '../storage.service';
import { FILE_UPLOAD_QUEUE } from './file-upload.constants';

export interface FileUploadJobData {
  tempPath: string;
  folderId: string | undefined;
  originalName: string;
  mimeType: string;
}

const workerConcurrency = Math.max(
  1,
  Number(process.env.UPLOAD_QUEUE_CONCURRENCY ?? '3'),
);

@Processor(FILE_UPLOAD_QUEUE, { concurrency: workerConcurrency })
export class FileUploadProcessor extends WorkerHost {
  private readonly log = new Logger(FileUploadProcessor.name);

  constructor(private readonly storage: StorageService) {
    super();
  }

  async process(job: Job<FileUploadJobData>): Promise<StoredFile> {
    const { tempPath, folderId, originalName, mimeType } = job.data;
    const buffer = await readFile(tempPath);
    const saved = await this.storage.saveUploadedFile(folderId, originalName, mimeType, buffer);
    await unlink(tempPath).catch((err) =>
      this.log.warn(`Không xóa được file tạm ${tempPath}: ${String(err)}`),
    );
    return saved;
  }

  /** Sau lần thử cuối — dọn file tạm nếu process không unlink được (lỗi sau readFile). */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<FileUploadJobData>): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }
    const { tempPath } = job.data;
    await unlink(tempPath).catch((err) =>
      this.log.warn(`Không xóa được file tạm sau failed: ${tempPath}: ${String(err)}`),
    );
  }
}
