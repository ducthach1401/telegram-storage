import { BadRequestException } from '@nestjs/common';

export interface FileListCursorPayload {
  /** Tên file — sort key */
  n: string;
  /** UUID — tie-break */
  i: string;
}

export function encodeFileListCursor(name: string, id: string): string {
  const json = JSON.stringify({ n: name, i: id } satisfies FileListCursorPayload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeFileListCursor(cursor: string): FileListCursorPayload {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const v = JSON.parse(json) as Partial<FileListCursorPayload>;
    if (typeof v.n !== 'string' || typeof v.i !== 'string') {
      throw new Error('invalid shape');
    }
    return { n: v.n, i: v.i };
  } catch {
    throw new BadRequestException('fileCursor không hợp lệ');
  }
}
