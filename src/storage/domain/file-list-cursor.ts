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

/** Cùng định dạng với file (sort name + id); dùng cho foldersNextCursor. */
export const encodeFolderListCursor = encodeFileListCursor;

function parseNameIdCursor(cursor: string): FileListCursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const v = JSON.parse(json) as Partial<FileListCursorPayload>;
    if (typeof v.n !== 'string' || typeof v.i !== 'string') {
      return null;
    }
    return { n: v.n, i: v.i };
  } catch {
    return null;
  }
}

export function decodeFileListCursor(cursor: string): FileListCursorPayload {
  const p = parseNameIdCursor(cursor);
  if (!p) {
    throw new BadRequestException('fileCursor không hợp lệ');
  }
  return p;
}

export function decodeFolderListCursor(cursor: string): FileListCursorPayload {
  const p = parseNameIdCursor(cursor);
  if (!p) {
    throw new BadRequestException('folderCursor không hợp lệ');
  }
  return p;
}
