import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from './entities/folder.entity';
import { StoredFile } from './entities/stored-file.entity';
import { FileController } from './file.controller';
import { FolderController } from './folder.controller';
import { StorageService } from './storage.service';
import { TelegramService } from './telegram.service';

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
  ],
  controllers: [FolderController, FileController],
  providers: [StorageService, TelegramService],
})
export class StorageModule {}
