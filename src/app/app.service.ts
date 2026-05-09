import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvKey } from '../common/env-keys';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getServiceName(): string {
    return this.config.getOrThrow<string>(EnvKey.SERVICE_NAME);
  }
}
