import { mkdir, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

export const TMP_STORAGE_LIMIT_BYTES = 512 * 1024 * 1024;
export const TMP_STORAGE_LIMIT_ERROR_CODE = 'TMP_LIMIT_EXCEEDED';

type TmpFileEntry = {
  path: string;
  size: number;
  mtimeMs: number;
};

let trimChain: Promise<void> = Promise.resolve();

async function collectFilesRecursive(rootDir: string): Promise<TmpFileEntry[]> {
  const files: TmpFileEntry[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const st = await stat(absolute).catch(() => null);
      if (!st || !st.isFile()) {
        continue;
      }
      files.push({
        path: absolute,
        size: st.size,
        mtimeMs: st.mtimeMs,
      });
    }
  }

  return files;
}

async function trimTempDir(rootDir: string, maxBytes: number): Promise<void> {
  await mkdir(rootDir, { recursive: true });
  const files = await collectFilesRecursive(rootDir);
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes <= maxBytes) {
    return;
  }

  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const file of files) {
    try {
      await unlink(file.path);
      totalBytes -= file.size;
    } catch {
      /* best effort */
    }
    if (totalBytes <= maxBytes) {
      return;
    }
  }

  const err = new Error(
    `Temp storage over limit: ${totalBytes} > ${maxBytes} bytes after cleanup`,
  ) as Error & { code?: string };
  err.code = TMP_STORAGE_LIMIT_ERROR_CODE;
  throw err;
}

/**
 * Serialize trim operations to avoid concurrent scans/deletes stepping on each other.
 */
export function enforceTempStorageLimit(rootDir: string, maxBytes = TMP_STORAGE_LIMIT_BYTES): Promise<void> {
  const run = trimChain.then(() => trimTempDir(rootDir, maxBytes));
  trimChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
