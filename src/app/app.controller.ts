import { Controller, Get, Header } from "@nestjs/common";
import { ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
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
}
