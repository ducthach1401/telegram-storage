import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BasicAuthGuard } from "../auth/basic-auth.guard";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { StorageModule } from "../storage/storage.module";
import { Folder } from "../storage/domain/entities/folder.entity";
import { StoredFile } from "../storage/domain/entities/stored-file.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "mysql" as const,
        host: config.getOrThrow<string>("MYSQL_HOST"),
        port: Number(config.getOrThrow<string>("MYSQL_PORT")),
        username: config.getOrThrow<string>("MYSQL_USER"),
        password: config.getOrThrow<string>("MYSQL_PASSWORD"),
        database: config.getOrThrow<string>("MYSQL_DATABASE"),
        charset: "utf8mb4",
        entities: [Folder, StoredFile],
        synchronize:
          config.getOrThrow<string>("TYPEORM_SYNCHRONIZE") === "true",
      }),
    }),
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: BasicAuthGuard,
    },
  ],
})
export class AppModule {}
