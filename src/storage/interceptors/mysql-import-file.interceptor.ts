import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
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
      limits: { fileSize: this.runtime.mysqlImportMaxBytes() },
      storage: diskStorage({
        destination: (_r, _f, cb) => {
          const base =
            process.env[EnvKey.UPLOAD_TMP_DIR]?.trim() ||
            join(process.cwd(), 'tmp', 'uploads');
          const dir = join(base, 'mysql-import');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
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
          subscriber.error(err);
          return;
        }
        next.handle().subscribe(subscriber);
      });
    });
  }
}
