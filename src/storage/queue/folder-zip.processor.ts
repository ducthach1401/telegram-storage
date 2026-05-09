import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { unlink } from 'fs/promises';
import { StorageService } from '../storage.service';
import { BullMqWorkerEvent } from './file-upload.constants';
import { FOLDER_ZIP_QUEUE } from './folder-zip.constants';

export interface FolderZipJobData {
  folderIdParam: string;
}

export interface FolderZipJobResult {
  zipPath: string;
  zipBaseName: string;
}

@Processor(FOLDER_ZIP_QUEUE)
export class FolderZipProcessor extends WorkerHost {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async process(job: Job<FolderZipJobData>): Promise<FolderZipJobResult> {
    const { entries, zipBaseName } = await this.storage.prepareFolderZipArchive(
      job.data.folderIdParam,
    );
    const jobIdStr = job.id !== undefined ? String(job.id) : '';
    const zipPath = this.storage.resolveFolderZipOutputPath(jobIdStr);
    await this.storage.writeFolderZipToDisk(entries, zipBaseName, zipPath);
    return { zipPath, zipBaseName };
  }

  @OnWorkerEvent(BullMqWorkerEvent.FAILED)
  async onFailed(job: Job<FolderZipJobData>): Promise<void> {
    const jobIdStr = job.id !== undefined ? String(job.id) : '';
    if (!jobIdStr) {
      return;
    }
    const zipPath = this.storage.resolveFolderZipOutputPath(jobIdStr);
    await unlink(zipPath).catch(() => undefined);
  }
}
