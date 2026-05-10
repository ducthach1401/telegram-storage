import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { join } from "path";
import { AppModule } from "./app/app.module";
import { ApiExceptionMessage } from "./common/api-messages";
import { EnvKey } from "./common/env-keys";
import { ProcessLifecycleSignal } from "./common/http.constants";
import { setupSwagger } from "./swagger.setup";

function assertDownloadShareSecret(config: ConfigService): void {
  const secret = config.get<string>(EnvKey.DOWNLOAD_SHARE_SECRET)?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(ApiExceptionMessage.MISSING_DOWNLOAD_SHARE_SECRET);
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  assertDownloadShareSecret(config);

  app.enableShutdownHooks();
  app.enableCors();
  const publicDir = join(process.cwd(), "public");
  app.useStaticAssets(publicDir);
  setupSwagger(app);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const httpApp = app.getHttpAdapter().getInstance();

  httpApp.get("/swagger", (_req: Request, res: Response) =>
    res.redirect(302, "/api/documentation"),
  );
  httpApp.get("/docs", (_req: Request, res: Response) =>
    res.redirect(302, "/api/documentation"),
  );
  httpApp.get("/login", (_req: Request, res: Response) =>
    res.redirect(302, "/login.html"),
  );
  httpApp.get("/register", (_req: Request, res: Response) =>
    res.redirect(302, "/register.html"),
  );

  /** Deep-link SPA / bookmark không có `#`: tránh 404 khi không phải `/api/*` hay file tĩnh có đuôi. */
  httpApp.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    if (/\.\w+$/.test(req.path)) {
      next();
      return;
    }
    res.sendFile(join(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });

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
