import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app/app.module";
import { setupSwagger } from "./swagger.setup";

function assertBasicAuthEnv(config: ConfigService): void {
  const user = config.get<string>("API_BASIC_AUTH_USER")?.trim();
  const pass = config.get<string>("API_BASIC_AUTH_PASSWORD")?.trim();
  if (!user) {
    throw new Error(
      "Thiếu hoặc rỗng API_BASIC_AUTH_USER — xem .env.example và file .env",
    );
  }
  if (!pass) {
    throw new Error(
      "Thiếu hoặc rỗng API_BASIC_AUTH_PASSWORD — xem .env.example và file .env",
    );
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  assertBasicAuthEnv(config);

  app.enableShutdownHooks();
  app.enableCors();
  setupSwagger(app);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(config.getOrThrow<string>("APP_PORT"));
  await app.listen(port);

  if (typeof process.send === "function") {
    process.send("ready");
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
