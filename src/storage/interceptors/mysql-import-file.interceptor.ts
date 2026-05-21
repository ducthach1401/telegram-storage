import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import multer from 'multer';
import { join } from 'path';
import { Observable } from 'rxjs';
import { EnvKey } from '../../common/env-keys';
import { RuntimeConfigService } from '../../settings/runtime-config.service';
import { FileMultipart } from '../storage-http.constants';
import {
  TMP_STORAGE_LIMIT_BYTES,
  TMP_STORAGE_LIMIT_ERROR_CODE,
  enforceTempStorageLimit,
} from '../tmp-storage-limit';

function dumpFilenameSuffix(original: string): string {
  const l = original.toLowerCase();
  if (l.endsWith('.sql.gz')) {
    return '.sql.gz';
  }
  if (l.endsWith('.gz')) {
    return '.gz';
  }
  if (l.endsWith('.sql')) {
    return '.sql';
  }
  return '';
}

@Injectable()
export class MysqlImportMulterInterceptor implements NestInterceptor {
  constructor(private readonly runtime: RuntimeConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const upload = multer({
      limits: {
        fileSize: Math.min(this.runtime.mysqlImportMaxBytes(), TMP_STORAGE_LIMIT_BYTES),
      },
      storage: diskStorage({
        destination: (_r, _f, cb) => {
          const base =
            process.env[EnvKey.UPLOAD_TMP_DIR]?.trim() ||
            join(process.cwd(), 'tmp', 'uploads');
          const dir = join(base, 'mysql-import');
          mkdirSync(dir, { recursive: true });
          enforceTempStorageLimit(base)
            .then(() => cb(null, dir))
            .catch((err: unknown) => cb(err as Error, dir));
        },
        filename: (_r, file, cb) => {
          const suf = dumpFilenameSuffix(file.originalname);
          cb(null, `${randomUUID()}${suf}`);
        },
      }),
    }).single(FileMultipart.FIELD_FILE);

    return new Observable((subscriber) => {
      upload(req, res, (err: unknown) => {
        if (err) {
          const code = (err as { code?: string }).code;
          if (code === 'LIMIT_FILE_SIZE') {
            subscriber.error(
              new PayloadTooLargeException(
                'Dump vượt giới hạn import hoặc trần temp 512MB.',
              ),
            );
            return;
          }
          if (code === TMP_STORAGE_LIMIT_ERROR_CODE) {
            subscriber.error(
              new PayloadTooLargeException(
                'Bộ nhớ tạm đã đầy (>512MB) và không thể dọn thêm file cũ.',
              ),
            );
            return;
          }
          subscriber.error(err);
          return;
        }
        next.handle().subscribe(subscriber);
      });
    });
  }
}
