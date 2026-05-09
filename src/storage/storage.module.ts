import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from './domain/entities/folder.entity';
import { StoredFile } from './domain/entities/stored-file.entity';
import { FileController } from './file/file.controller';
import { FolderController } from './folder/folder.controller';
import { FILE_UPLOAD_QUEUE } from './queue/file-upload.constants';
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
          fileSize: Number(config.getOrThrow<string>('MAX_UPLOAD_MB')) * 1024 * 1024,
        },
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: Number(config.getOrThrow<string>('REDIS_PORT')),
          ...(config.get<string>('REDIS_PASSWORD')
            ? { password: config.get<string>('REDIS_PASSWORD') }
            : {}),
        },
      }),
    }),
    BullModule.registerQueue({
      name: FILE_UPLOAD_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 4000,
        },
        removeOnComplete: {
          count: 500,
        },
        removeOnFail: false,
      },
    }),
  ],
  controllers: [FolderController, FileController],
  providers: [StorageService, TelegramService, FileUploadProcessor],
})
export class StorageModule {}
