import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { Account } from "../accounts/account.entity";
import { AccountService } from "../accounts/account.service";
import { CurrentAccount } from "../accounts/current-account.decorator";
import { API_V1_PREFIX } from "../common/api-route";
import { HttpHeader, MimeType } from "../common/http.constants";
import { AppService } from "./app.service";

@ApiTags("app")
@Controller(API_V1_PREFIX)
export class AppController {
  constructor(
    private readonly app: AppService,
    private readonly accounts: AccountService,
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
      },
    },
  })
  verifyAuth(@CurrentAccount() account: Account): {
    ok: true;
    service: string;
    username: string;
    role: string;
    rootFolderId: string;
    maxUploadBytes: number;
    minioLimitBytes: number;
    telegramUsePlatformDefaults: boolean;
    telegramStorageChatId: string;
    hasTelegramBotToken: boolean;
    isPrimaryAdmin: boolean;
  } {
    return {
      ok: true,
      service: this.app.getServiceName(),
      username: account.username,
      role: account.role,
      rootFolderId: account.rootFolderId,
      maxUploadBytes: this.app.maxUploadBytesForAccount(account),
      minioLimitBytes: this.app.accountMinioQuotaBytes(account),
      telegramUsePlatformDefaults: account.telegramUsePlatformDefaults,
      telegramStorageChatId: account.telegramStorageChatId ?? '',
      hasTelegramBotToken: Boolean(account.telegramBotToken?.trim()),
      isPrimaryAdmin: this.accounts.isPrimaryAdminSync(account.id),
    };
  }
}
