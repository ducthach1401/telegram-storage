import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { OgmaInterceptor, OgmaModule } from "@ogma/nestjs-module";
import { ExpressParser } from "@ogma/platform-express";
import { MysqlBackupSchedulerService } from "../backup/mysql-backup.scheduler";
import { BasicAuthGuard } from "../auth/basic-auth.guard";
import { ShareRouteThrottlerGuard } from "../auth/share-throttler.guard";
import { EnvKey } from "../common/env-keys";
import { FileTag } from "../storage/domain/entities/file-tag.entity";
import { Folder } from "../storage/domain/entities/folder.entity";
import { StoredFile } from "../storage/domain/entities/stored-file.entity";
import { StorageModule } from "../storage/storage.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TelegramAlertExceptionFilter } from "./telegram-alert-exception.filter";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    OgmaModule.forRoot({
      application: "telegram-storage",
      color: process.env.NODE_ENV !== "production",
      json: process.env.NODE_ENV === "production",
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "mysql" as const,
        host: config.getOrThrow<string>(EnvKey.MYSQL_HOST),
        port: Number(config.getOrThrow<string>(EnvKey.MYSQL_PORT)),
        username: config.getOrThrow<string>(EnvKey.MYSQL_USER),
        password: config.getOrThrow<string>(EnvKey.MYSQL_PASSWORD),
        database: config.getOrThrow<string>(EnvKey.MYSQL_DATABASE),
        charset: "utf8mb4",
        entities: [Folder, StoredFile, FileTag],
        synchronize:
          config.getOrThrow<string>(EnvKey.TYPEORM_SYNCHRONIZE) === "true",
      }),
    }),
    StorageModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Math.max(
              1000,
              Number(config.get<string>(EnvKey.SHARE_RATE_LIMIT_TTL_MS) ?? 60000),
            ),
            limit: Math.max(
              1,
              Number(config.get<string>(EnvKey.SHARE_RATE_LIMIT_MAX) ?? 60),
            ),
          },
        ],
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    MysqlBackupSchedulerService,
    ExpressParser,
    {
      provide: APP_INTERCEPTOR,
      useClass: OgmaInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ShareRouteThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BasicAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: TelegramAlertExceptionFilter,
    },
  ],
})
export class AppModule {}
