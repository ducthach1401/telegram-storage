import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app/app.module";
import { ApiExceptionMessage } from "./common/api-messages";
import { EnvKey } from "./common/env-keys";
import { ProcessLifecycleSignal } from "./common/http.constants";
import { setupSwagger } from "./swagger.setup";

function assertBasicAuthEnv(config: ConfigService): void {
  const user = config.get<string>(EnvKey.API_BASIC_AUTH_USER)?.trim();
  const pass = config.get<string>(EnvKey.API_BASIC_AUTH_PASSWORD)?.trim();
  if (!user) {
    throw new Error(ApiExceptionMessage.MISSING_BASIC_AUTH_USER);
  }
  if (!pass) {
    throw new Error(ApiExceptionMessage.MISSING_BASIC_AUTH_PASSWORD);
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

  const port = Number(config.getOrThrow<string>(EnvKey.APP_PORT));
  await app.listen(port);

  if (typeof process.send === "function") {
    process.send(ProcessLifecycleSignal.PM2_READY);
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
