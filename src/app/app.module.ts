import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { OgmaInterceptor, OgmaModule } from "@ogma/nestjs-module";
import { ExpressParser } from "@ogma/platform-express";
import { MysqlBackupSchedulerService } from "../backup/mysql-backup.scheduler";
import { AccountsModule } from "../accounts/accounts.module";
import { Account } from "../accounts/account.entity";
import { BasicAuthGuard } from "../auth/basic-auth.guard";
import { ShareRouteThrottlerGuard } from "../auth/share-throttler.guard";
import { EnvKey } from "../common/env-keys";
import { FileTag } from "../storage/domain/entities/file-tag.entity";
import { Folder } from "../storage/domain/entities/folder.entity";
import { StoredFile } from "../storage/domain/entities/stored-file.entity";
import { StorageModule } from "../storage/storage.module";
import { AppSetting } from "../settings/app-setting.entity";
import { RuntimeConfigService } from "../settings/runtime-config.service";
import { SettingsModule } from "../settings/settings.module";
import { AdminRuntimeSettingsController } from "./admin-runtime-settings.controller";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TelegramAlertExceptionFilter } from "./telegram-alert-exception.filter";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
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
        entities: [Folder, StoredFile, FileTag, Account, AppSetting],
        synchronize:
          config.getOrThrow<string>(EnvKey.TYPEORM_SYNCHRONIZE) === "true",
      }),
    }),
    SettingsModule,
    AccountsModule,
    StorageModule,
    ThrottlerModule.forRootAsync({
      imports: [SettingsModule],
      inject: [RuntimeConfigService],
      useFactory: (runtime: RuntimeConfigService) => ({
        throttlers: [
          {
            name: "default",
            ttl: () => runtime.shareRateLimitTtlMs(),
            limit: () => runtime.shareRateLimitMax(),
          },
        ],
      }),
    }),
  ],
  controllers: [AppController, AdminRuntimeSettingsController],
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
