import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoredFile } from '../domain/entities/stored-file.entity';
import { StorageService } from '../storage.service';
import { TelegramService } from '../telegram/telegram.service';
import { ReconcileRequestDto } from './dto/reconcile-request.dto';
import { ReconcileResponseDto } from './dto/reconcile-response.dto';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ReconcileService {
  constructor(
    @InjectRepository(StoredFile)
    private readonly fileRepo: Repository<StoredFile>,
    private readonly telegram: TelegramService,
    private readonly storage: StorageService,
  ) {}

  async reconcileStoredFiles(dto: ReconcileRequestDto): Promise<ReconcileResponseDto> {
    const dryRun = dto.dryRun ?? false;
    const batchSize = dto.batchSize ?? 50;
    const maxTotal = dto.maxTotal ?? 1000;
    const delayMs = dto.delayMsBetweenChecks ?? 50;

    let scanned = 0;
    let staleFound = 0;
    let removedFromDb = 0;
    let lastId: string | null = null;

    while (scanned < maxTotal) {
      const remaining = maxTotal - scanned;
      const limit = Math.min(batchSize, remaining);
      const qb = this.fileRepo.createQueryBuilder('f').orderBy('f.id', 'ASC').take(limit);
      if (lastId !== null) {
        qb.andWhere('f.id > :lastId', { lastId });
      }
      const batch = await qb.getMany();
      if (batch.length === 0) {
        break;
      }

      for (const file of batch) {
        const ok = await this.telegram.isTelegramDocumentAccessible(file.telegramFileId);
        if (delayMs > 0) {
          await sleep(delayMs);
        }

        scanned++;
        lastId = file.id;

        if (ok) {
          if (scanned >= maxTotal) {
            break;
          }
          continue;
        }

        staleFound++;
        if (!dryRun) {
          await this.storage.deleteFile(file.id);
          removedFromDb++;
        }

        if (scanned >= maxTotal) {
          break;
        }
      }

      if (batch.length < limit) {
        break;
      }
    }

    return {
      scanned,
      staleFound,
      removedFromDb,
      dryRun,
    };
  }
}
