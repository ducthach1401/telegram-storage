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
import {
  TMP_STORAGE_LIMIT_BYTES,
  TMP_STORAGE_LIMIT_ERROR_CODE,
} from '../tmp-storage-limit';

/** Multer disk upload với `limits.fileSize` theo quota MinIO của account đăng nhập (không trần server). */
export function accountLimitedFileInterceptor(fieldName: string): Type<NestInterceptor> {
  @Injectable()
  class Interceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
      const req = context.switchToHttp().getRequest();
      const res = context.switchToHttp().getResponse();
      const account = req.account as { minioLimitGb?: number } | undefined;
      const limit = Math.min(
        multerMaxFileBytesForAccount(account?.minioLimitGb ?? 0),
        TMP_STORAGE_LIMIT_BYTES,
      );

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
                  'File vượt giới hạn cho tài khoản hoặc trần temp 512MB.',
                ),
              );
              return;
            }
            if (code === TMP_STORAGE_LIMIT_ERROR_CODE) {
              subscriber.error(
                new PayloadTooLargeException(
                  'Bộ nhớ tạm đã đầy (>512MB) và không thể dọn thêm file cũ. Hãy thử lại sau hoặc dọn queue lỗi.',
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
