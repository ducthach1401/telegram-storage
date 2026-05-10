import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { stat, unlink } from 'fs/promises';
import { StoredFile } from '../domain/entities/stored-file.entity';
import { TelegramService } from '../telegram/telegram.service';
import { StorageService } from '../storage.service';
import { EnvKey } from '../../common/env-keys';
import { UploadDefaults } from '../../common/upload.defaults';
import {
  BullMqWorkerEvent,
  FILE_UPLOAD_QUEUE,
} from './file-upload.constants';

export interface FileUploadJobData {
  tempPath: string;
  folderId: string | undefined;
  /** Tên file sau xử lý trùng (reject/overwrite/suffix) trước khi enqueue */
  finalFileName: string;
  mimeType: string;
}

const workerConcurrency = Math.max(
  1,
  Number(
    process.env[EnvKey.UPLOAD_QUEUE_CONCURRENCY] ??
      String(UploadDefaults.QUEUE_CONCURRENCY_FALLBACK),
  ),
);

@Processor(FILE_UPLOAD_QUEUE, { concurrency: workerConcurrency })
export class FileUploadProcessor extends WorkerHost {
  private readonly log = new Logger(FileUploadProcessor.name);

  constructor(
    private readonly storage: StorageService,
    private readonly telegram: TelegramService,
  ) {
    super();
  }

  async process(job: Job<FileUploadJobData>): Promise<StoredFile> {
    const { tempPath, folderId, finalFileName, mimeType } = job.data;
    const fileStat = await stat(tempPath);
    const folderResolved = this.storage.uploadTargetFolderId(folderId);
    const saved = await this.persistWithPermanentErrorCheck(
      folderResolved,
      finalFileName,
      mimeType,
      tempPath,
      fileStat.size,
    );
    await unlink(tempPath).catch((err) =>
      this.log.warn(`Không xóa được file tạm ${tempPath}: ${String(err)}`),
    );
    return saved;
  }

  private async persistWithPermanentErrorCheck(
    folderId: string,
    finalFileName: string,
    mimeType: string,
    tempPath: string,
    size: number,
  ): Promise<StoredFile> {
    try {
      return await this.storage.persistUploadedDocumentFromPath(
        folderId,
        finalFileName,
        mimeType,
        tempPath,
        size,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('401: Unauthorized')) {
        throw new UnrecoverableError(
          'Telegram Bot token không hợp lệ hoặc đã bị revoke (401 Unauthorized). Kiểm tra TELEGRAM_BOT_TOKEN trong .env rồi restart container.',
        );
      }
      throw err;
    }
  }

  /** Sau lần thử cuối — giữ file tạm để admin có thể retry/re-upload job failed. */
  @OnWorkerEvent(BullMqWorkerEvent.FAILED)
  async onFailed(job: Job<FileUploadJobData>): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      this.log.warn(
        `Upload job ${String(job.id)} lỗi, sẽ retry (${job.attemptsMade}/${maxAttempts}): ${
          job.failedReason ?? '(không có failedReason)'
        }`,
      );
      return;
    }
    const reason = job.failedReason ?? '(không có failedReason)';
    void this.telegram.sendAlertPlainText(
      [
        '🚨 Telegram Storage — upload queue thất bại (hết retry)',
        `jobId: ${String(job.id)}`,
        `file: ${job.data.finalFileName}`,
        `mimeType: ${job.data.mimeType}`,
        'File tạm được giữ lại để admin retry/re-upload qua API queue.',
        reason,
      ].join('\n'),
    );
  }
}
