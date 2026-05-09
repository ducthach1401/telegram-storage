import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvKey } from '../common/env-keys';
import { Folder } from './domain/entities/folder.entity';
import { StoredFile } from './domain/entities/stored-file.entity';
import { FilesDuplicatesController } from './admin/files-duplicates.controller';
import { MysqlImportController } from './admin/mysql-import.controller';
import { MysqlImportService } from './admin/mysql-import.service';
import { QueueAdminController } from './admin/queue-admin.controller';
import { ReconcileController } from './admin/reconcile.controller';
import { ReconcileService } from './admin/reconcile.service';
import { FileController } from './file/file.controller';
import { FolderController } from './folder/folder.controller';
import { SharedFileController } from './shared/shared-file.controller';
import { ShareDownloadTokenService } from './share/share-download-token.service';
import {
  BullMqBackoffType,
  FILE_UPLOAD_QUEUE,
} from './queue/file-upload.constants';
import { FileUploadProcessor } from './queue/file-upload.processor';
import { FOLDER_ZIP_QUEUE } from './queue/folder-zip.constants';
import { FolderZipProcessor } from './queue/folder-zip.processor';
import { FolderZipDownloadTokenService } from './share/folder-zip-download-token.service';
import { StorageService } from './storage.service';
import { TelegramSyncService } from './telegram/telegram-sync.service';
import { TelegramWebhookController } from './telegram/telegram-webhook.controller';
import { TelegramService } from './telegram/telegram.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Folder, StoredFile]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize:
            Number(config.getOrThrow<string>(EnvKey.MAX_UPLOAD_MB)) * 1024 * 1024,
        },
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>(EnvKey.REDIS_HOST),
          port: Number(config.getOrThrow<string>(EnvKey.REDIS_PORT)),
        },
      }),
    }),
    BullModule.registerQueue({
      name: FILE_UPLOAD_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: BullMqBackoffType.EXPONENTIAL,
          delay: 4000,
        },
        removeOnComplete: {
          count: 500,
        },
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: FOLDER_ZIP_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: BullMqBackoffType.EXPONENTIAL,
          delay: 8000,
        },
        removeOnComplete: {
          count: 200,
        },
        removeOnFail: false,
      },
    }),
  ],
  controllers: [
    FolderController,
    FileController,
    SharedFileController,
    TelegramWebhookController,
    QueueAdminController,
    ReconcileController,
    FilesDuplicatesController,
    MysqlImportController,
  ],
  providers: [
    StorageService,
    TelegramService,
    ShareDownloadTokenService,
    FolderZipDownloadTokenService,
    FileUploadProcessor,
    FolderZipProcessor,
    TelegramSyncService,
    ReconcileService,
    MysqlImportService,
  ],
  exports: [TelegramService, StorageService],
})
export class StorageModule {}
