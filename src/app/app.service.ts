import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Account } from '../accounts/account.entity';
import { EnvKey } from '../common/env-keys';
import { multerMaxFileBytesForAccount } from '../common/upload-limit';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getServiceName(): string {
    return this.config.getOrThrow<string>(EnvKey.SERVICE_NAME);
  }

  /** Giới hạn kích thước multipart — chỉ theo quota MinIO của account. */
  maxUploadBytesForAccount(account: Account): number {
    return multerMaxFileBytesForAccount(account.minioLimitGb);
  }

  /** Quota MinIO đã gán cho account (bytes); 0 = chỉ đường Telegram (dưới 20MB). */
  accountMinioQuotaBytes(account: Account): number {
    const gb = Number(account.minioLimitGb);
    return Math.floor(Math.max(0, Number.isFinite(gb) ? gb : 0) * 1024 * 1024 * 1024);
  }

}
