import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { diskStorage } from 'multer';
import { EnvKey } from '../common/env-keys';
import { enforceTempStorageLimit } from './tmp-storage-limit';

const dir =
  process.env[EnvKey.UPLOAD_TMP_DIR] ?? join(process.cwd(), 'tmp', 'uploads');
mkdirSync(dir, { recursive: true });

/** Multer disk storage cho upload async (file tạm chờ worker đọc). */
export const asyncUploadDiskStorage = diskStorage({
  destination: (_req, _file, cb) => {
    enforceTempStorageLimit(dir)
      .then(() => cb(null, dir))
      .catch((err: unknown) => cb(err as Error, dir));
  },
  filename: (_req, _file, cb) => cb(null, randomUUID()),
});
