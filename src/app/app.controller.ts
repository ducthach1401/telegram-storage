import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import { API_V1_PREFIX } from "../common/api-route";
import { HttpHeader, MimeType } from "../common/http.constants";
import { AppService } from "./app.service";

@ApiTags("app")
@Controller(API_V1_PREFIX)
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get()
  @ApiOperation({ summary: "Tên service (plain text)" })
  @ApiProduces("text/plain; charset=utf-8")
  @Header(HttpHeader.CONTENT_TYPE, MimeType.TEXT_PLAIN_UTF8)
  getServiceName(): string {
    return this.app.getServiceName();
  }

  @Get("auth/verify")
  @ApiOperation({ summary: "Verify Basic Auth hiện tại" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean", example: true },
        service: { type: "string", example: "telegram-storage" },
        maxUploadBytes: { type: "number", example: 53687091200 },
        minioLimitBytes: { type: "number", example: 53687091200 },
      },
    },
  })
  verifyAuth(): { ok: true; service: string; maxUploadBytes: number; minioLimitBytes: number } {
    return {
      ok: true,
      service: this.app.getServiceName(),
      maxUploadBytes: this.app.getMaxUploadBytes(),
      minioLimitBytes: this.app.getMinioLimitBytes(),
    };
  }
}
