import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvKey } from '../common/env-keys';
import { UploadDefaults } from '../common/upload.defaults';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getServiceName(): string {
    return this.config.getOrThrow<string>(EnvKey.SERVICE_NAME);
  }

  getMaxUploadBytes(): number {
    return this.getMinioLimitBytes();
  }

  getMinioLimitBytes(): number {
    const gb = Number(
      this.config.get<string>(EnvKey.MINIO_LIMIT_GB) ??
        String(UploadDefaults.MINIO_LIMIT_GB_FALLBACK),
    );
    const safeGb = Number.isFinite(gb) && gb > 0 ? gb : UploadDefaults.MINIO_LIMIT_GB_FALLBACK;
    return Math.floor(safeGb * 1024 * 1024 * 1024);
  }
}
