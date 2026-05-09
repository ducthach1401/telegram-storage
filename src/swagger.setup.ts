import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication): void {
  const builder = new DocumentBuilder()
    .setTitle("Telegram Storage API")
    .setDescription(
      "Luôn cần **Basic Auth** (`Authorization: Basic …`). User/password trong `.env`: `API_BASIC_AUTH_USER`, `API_BASIC_AUTH_PASSWORD`.",
    )
    .setVersion("1.0")
    .addTag("app", "Thông tin service")
    .addTag("folders", "Thư mục (drive)")
    .addTag("files", "Upload & truy cập file")
    .addTag(
      "admin",
      "Queue BullMQ & reconcile DB ↔ Telegram (Basic Auth như mọi endpoint)",
    )
    .addBasicAuth(
      {
        type: "http",
        scheme: "basic",
        description:
          "Biến môi trường: API_BASIC_AUTH_USER, API_BASIC_AUTH_PASSWORD",
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
