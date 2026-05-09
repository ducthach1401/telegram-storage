import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableShutdownHooks();
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(config.getOrThrow<string>('PORT'));
  await app.listen(port, config.getOrThrow<string>('HOST'));

  if (typeof process.send === 'function') {
    process.send('ready');
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
