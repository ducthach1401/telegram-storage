import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getServiceName(): string {
    return this.config.getOrThrow<string>('SERVICE_NAME');
  }
}
