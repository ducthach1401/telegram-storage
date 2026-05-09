import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvKey } from '../common/env-keys';
import { Folder } from './domain/entities/folder.entity';
import { StoredFile } from './domain/entities/stored-file.entity';
import { QueueAdminController } from './admin/queue-admin.controller';
import { ReconcileController } from './admin/reconcile.controller';
import { ReconcileService } from './admin/reconcile.service';
import { FileController } from './file/file.controller';
import { FolderController } from './folder/folder.controller';
import {
  BullMqBackoffType,
  FILE_UPLOAD_QUEUE,
} from './queue/file-upload.constants';
import { FileUploadProcessor } from './queue/file-upload.processor';
import { StorageService } from './storage.service';
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
      useFactory: (config: ConfigService) => {
        const redisPassword = config.get<string>(EnvKey.REDIS_PASSWORD);
        return {
          connection: {
            host: config.getOrThrow<string>(EnvKey.REDIS_HOST),
            port: Number(config.getOrThrow<string>(EnvKey.REDIS_PORT)),
            ...(redisPassword ? { password: redisPassword } : {}),
          },
        };
      },
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
  ],
  controllers: [
    FolderController,
    FileController,
    QueueAdminController,
    ReconcileController,
  ],
  providers: [StorageService, TelegramService, FileUploadProcessor, ReconcileService],
})
export class StorageModule {}
