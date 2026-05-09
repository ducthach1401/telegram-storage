import { Controller, Get, Header } from "@nestjs/common";
import { ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import { API_V1_PREFIX } from "../common/api-route";
import { AppService } from "./app.service";

@ApiTags("app")
@Controller(API_V1_PREFIX)
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get()
  @ApiOperation({ summary: "Tên service (plain text)" })
  @ApiProduces("text/plain; charset=utf-8")
  @Header("Content-Type", "text/plain; charset=utf-8")
  getServiceName(): string {
    return this.app.getServiceName();
  }
}
