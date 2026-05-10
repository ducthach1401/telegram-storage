import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication): void {
  const builder = new DocumentBuilder()
    .setTitle("Telegram Storage API")
    .setDescription(
      "Hầu hết endpoint cần **Basic Auth** (`Authorization: Basic …`) với user/password trong bảng `accounts` (lần chạy đầu không có admin: server tự tạo admin và log mật khẩu một lần). Đăng ký user tại `POST /api/v1/auth/register`. Nhóm **shared** (`GET …/shared/files/download|view?token=`) **không** cần Basic Auth — chỉ cần token hợp lệ từ `POST …/files/:id/share-download`.",
    )
    .setVersion("1.0")
    .addTag("app", "Thông tin service")
    .addTag("folders", "Thư mục (drive)")
    .addTag("files", "Upload & truy cập file")
    .addTag(
      "shared",
      "Link tải/xem công khai — không Basic Auth; có giới hạn request/phút (Throttler, env SHARE_RATE_LIMIT_*)",
    )
    .addTag(
      "telegram",
      "Webhook đồng bộ ngược document vào DB (`POST …/telegram/webhook`)",
    )
    .addTag(
      "admin",
      "Queue BullMQ & reconcile DB ↔ Telegram (Basic Auth như mọi endpoint)",
    )
    .addBasicAuth(
      {
        type: "http",
        scheme: "basic",
        description:
          "User/password lấy từ DB (`accounts`) hoặc đăng ký qua API.",
      },
      "basic-auth",
    );

  const config = builder.build();
  const document = SwaggerModule.createDocument(app, config);
  document.security = [{ "basic-auth": [] }];

  SwaggerModule.setup("api/documentation", app, document, {
    jsonDocumentUrl: "api/documentation/swagger.json",
    yamlDocumentUrl: "api/documentation/swagger.yaml",
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
