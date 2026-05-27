import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { Account } from "../accounts/account.entity";
import { AccountService } from "../accounts/account.service";
import { CurrentAccount } from "../accounts/current-account.decorator";
import { API_V1_PREFIX } from "../common/api-route";
import { EnvKey } from "../common/env-keys";
import { HttpHeader, MimeType } from "../common/http.constants";
import { UploadDefaults } from "../common/upload.defaults";
import { RuntimeConfigService } from "../settings/runtime-config.service";
import { AppService } from "./app.service";

@ApiTags("app")
@Controller(API_V1_PREFIX)
export class AppController {
  constructor(
    private readonly app: AppService,
    private readonly accounts: AccountService,
    private readonly runtime: RuntimeConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Tên service (plain text)" })
  @ApiProduces("text/plain; charset=utf-8")
  @Header(HttpHeader.CONTENT_TYPE, MimeType.TEXT_PLAIN_UTF8)
  getServiceName(): string {
    return this.app.getServiceName();
  }

  @Get("auth/verify")
  @ApiOperation({ summary: "Verify Basic Auth hiện tại (theo account DB)" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean", example: true },
        service: { type: "string", example: "telegram-storage" },
        username: { type: "string" },
        role: { type: "string" },
        rootFolderId: { type: "string" },
        maxUploadBytes: { type: "number", example: 20971520 },
        minioLimitBytes: { type: "number", example: 0 },
        telegramUsePlatformDefaults: { type: "boolean" },
        telegramStorageChatId: { type: "string" },
        hasTelegramBotToken: { type: "boolean" },
        isPrimaryAdmin: { type: "boolean" },
        uploadQueueConcurrency: { type: "number", example: 8 },
        id: { type: "string" },
      },
    },
  })
  verifyAuth(@CurrentAccount() account: Account): {
    ok: true;
    service: string;
    id: string;
    username: string;
    role: string;
    rootFolderId: string;
    maxUploadBytes: number;
    minioLimitBytes: number;
    telegramUsePlatformDefaults: boolean;
    telegramStorageChatId: string;
    hasTelegramBotToken: boolean;
    isPrimaryAdmin: boolean;
    uploadQueueConcurrency: number;
  } {
    const queueConcurrency = Math.max(
      1,
      Number(
        this.runtime.effectiveRaw(EnvKey.UPLOAD_QUEUE_CONCURRENCY) ??
          String(UploadDefaults.QUEUE_CONCURRENCY_FALLBACK),
      ),
    );
    return {
      ok: true,
      service: this.app.getServiceName(),
      id: account.id,
      username: account.username,
      role: account.role,
      rootFolderId: account.rootFolderId,
      maxUploadBytes: this.app.maxUploadBytesForAccount(account),
      minioLimitBytes: this.app.accountMinioQuotaBytes(account),
      telegramUsePlatformDefaults: account.telegramUsePlatformDefaults,
      telegramStorageChatId: account.telegramStorageChatId ?? '',
      hasTelegramBotToken: Boolean(account.telegramBotToken?.trim()),
      isPrimaryAdmin: this.accounts.isPrimaryAdminSync(account.id),
      uploadQueueConcurrency: queueConcurrency,
    };
  }
}
