import {
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  PayloadTooLargeException,
  Type,
} from '@nestjs/common';
import multer from 'multer';
import { Observable } from 'rxjs';
import { repairUtf8FilenameMojibake } from '../../common/multipart-filename';
import { multerMaxFileBytesForAccount } from '../../common/upload-limit';
import { asyncUploadDiskStorage } from '../multer-async-disk.storage';

/** Multer disk upload với `limits.fileSize` theo quota MinIO của account đăng nhập (không trần server). */
export function accountLimitedFileInterceptor(fieldName: string): Type<NestInterceptor> {
  @Injectable()
  class Interceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
      const req = context.switchToHttp().getRequest();
      const res = context.switchToHttp().getResponse();
      const account = req.account as { minioLimitGb?: number } | undefined;
      const limit = multerMaxFileBytesForAccount(account?.minioLimitGb ?? 0);

      const upload = multer({
        storage: asyncUploadDiskStorage,
        limits: { fileSize: limit },
      }).single(fieldName);

      return new Observable((subscriber) => {
        upload(req, res, (err: unknown) => {
          if (err) {
            const code = (err as { code?: string }).code;
            if (code === 'LIMIT_FILE_SIZE') {
              subscriber.error(
                new PayloadTooLargeException(
                  'File vượt giới hạn cho tài khoản (MinIO quota hoặc tối đa ~20MB khi quota = 0).',
                ),
              );
              return;
            }
            subscriber.error(err);
            return;
          }
          if (req.file?.originalname) {
            req.file.originalname = repairUtf8FilenameMojibake(req.file.originalname);
          }
          next.handle().subscribe(subscriber);
        });
      });
    }
  }
  return mixin(Interceptor);
}
