import {
  createHash,
  randomUUID,
} from 'crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type archiver = require('archiver');
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readFile, unlink } from 'fs/promises';
import { request as httpsRequest } from 'https';
import { dirname, join } from 'path';
import type { Response } from 'express';
import { finished } from 'stream/promises';
import { Readable } from 'stream';
import sharp from 'sharp';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  ApiExceptionMessage,
  StorageExceptionMessage,
} from '../common/api-messages';
import { EnvKey } from '../common/env-keys';
import { telegramDownloadMaxBytes } from '../common/upload.defaults';
import {
  CacheControlValue,
  ContentDispositionMode,
  HttpHeader,
  MimeType,
} from '../common/http.constants';
import {
  MIME_PREFIX_IMAGE,
  ROOT_FOLDER_ALIAS,
  ROOT_FOLDER_ID,
  TYPEORM_ORDER_ASC,
  VIRTUAL_ROOT_FOLDER_NAME,
} from './domain/constants';
import type { DuplicateNamePolicy } from './domain/duplicate-name-policy';
import { CreateFolderDto } from './domain/dto/create-folder.dto';
import { FileTag } from './domain/entities/file-tag.entity';
import { Folder } from './domain/entities/folder.entity';
import { StoredFile } from './domain/entities/stored-file.entity';
import {
  decodeFileListCursor,
  decodeFolderListCursor,
  encodeFileListCursor,
  encodeFolderListCursor,
} from './domain/file-list-cursor';
import { contentDispositionHeader } from './content-disposition.header';
import { MinioStorageService } from './s3/minio-storage.service';
import { TelegramService } from './telegram/telegram.service';

export interface ListContentsOpts {
  /** Khi có — phân trang file theo cursor */
  fileLimit?: number;
  fileCursor?: string;
  /** Khi có — phân trang thư mục con theo cursor */
  folderLimit?: number;
  folderCursor?: string;
}

export interface FileSearchParams {
  q?: string;
  folderId?: string;
  mode: 'substring' | 'prefix';
  limit: number;
  mimeType?: string;
  mimePrefix?: string;
  minSize?: number;
  maxSize?: number;
  createdFrom?: string;
  createdTo?: string;
  hasThumbnail?: boolean;
  tags?: string[];
}

export interface StorageQuotaStats {
  totalFiles: number;
  totalFolders: number;
  totalBytes: number;
  trashedFiles: number;
  trashedBytes: number;
  minioBytes: number;
  minioLimitBytes: number;
  byMimeType: Array<{ mimeType: string; files: number; bytes: number }>;
}

interface PersistUploadOptions {
  allowDuplicateContent?: boolean;
}

const TELEGRAM_ONLY_MAX_BYTES = 20 * 1024 * 1024;
const TELEGRAM_BACKUP_MAX_BYTES = 50 * 1024 * 1024;

const { ZipArchive } = require('archiver') as {
  ZipArchive: new (options?: archiver.ArchiverOptions) => archiver.Archiver;
};

function createZipArchive(): archiver.Archiver {
  return new ZipArchive({ zlib: { level: 6 } });
}

@Injectable()
export class StorageService implements OnModuleInit {
  constructor(
    @InjectRepository(Folder)
    private readonly folderRepo: Repository<Folder>,
    @InjectRepository(StoredFile)
    private readonly fileRepo: Repository<StoredFile>,
    @InjectRepository(FileTag)
    private readonly tagRepo: Repository<FileTag>,
    private readonly telegram: TelegramService,
    private readonly minio: MinioStorageService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const root = await this.folderRepo.findOne({ where: { id: ROOT_FOLDER_ID } });
    if (!root) {
      await this.folderRepo.save(
        this.folderRepo.create({
          id: ROOT_FOLDER_ID,
          parentId: null,
          name: VIRTUAL_ROOT_FOLDER_NAME,
        }),
      );
    }
  }

  resolveFolderId(folderParam: string): string {
    return folderParam === ROOT_FOLDER_ALIAS ? ROOT_FOLDER_ID : folderParam;
  }

  /** Thư mục đích upload (multipart `folderId` rỗng = gốc). */
  uploadTargetFolderId(folderIdParam: string | undefined): string {
    if (folderIdParam === undefined || folderIdParam === '') {
      return ROOT_FOLDER_ID;
    }
    return this.resolveFolderId(folderIdParam);
  }

  async ensureFolder(id: string): Promise<Folder> {
    const folder = await this.folderRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!folder) {
      throw new NotFoundException(StorageExceptionMessage.FOLDER_NOT_FOUND);
    }
    return folder;
  }

  async createFolder(dto: CreateFolderDto): Promise<Folder> {
    const parentId = dto.parentId ?? ROOT_FOLDER_ID;
    await this.ensureFolder(parentId);
    const exists = await this.folderRepo.findOne({
      where: { parentId, name: dto.name, deletedAt: IsNull() },
    });
    if (exists) {
      throw new ConflictException(StorageExceptionMessage.FOLDER_DUPLICATE_NAME);
    }
    const folder = this.folderRepo.create({
      parentId,
      name: dto.name,
    });
    return this.folderRepo.save(folder);
  }

  /**
   * Đảm bảo có thư mục con `folderName` dưới `parentId`; không throw khi đã tồn tại (khác `createFolder`).
   */
  async ensureNamedChildFolder(parentId: string, folderName: string): Promise<string> {
    const name = folderName.trim();
    if (!name) {
      throw new BadRequestException(StorageExceptionMessage.FOLDER_NAME_EMPTY);
    }
    await this.ensureFolder(parentId);
    const existing = await this.folderRepo.findOne({
      where: { parentId, name, deletedAt: IsNull() },
    });
    if (existing) {
      return existing.id;
    }
    const created = await this.folderRepo.save(
      this.folderRepo.create({ parentId, name }),
    );
    return created.id;
  }

  async listContents(
    folderIdParam: string,
    opts?: ListContentsOpts,
  ): Promise<{
    folderId: string;
    folders: Folder[];
    files: StoredFile[];
    foldersNextCursor?: string | null;
    foldersLimit?: number;
    filesNextCursor?: string | null;
    filesLimit?: number;
  }> {
    const folderId = this.resolveFolderId(folderIdParam);
    await this.ensureFolder(folderId);

    const folderLimit = opts?.folderLimit;
    let folders: Folder[];
    let foldersNextCursor: string | null | undefined;
    let foldersLimit: number | undefined;

    if (!folderLimit) {
      folders = await this.folderRepo.find({
        where: { parentId: folderId, deletedAt: IsNull() },
        order: { name: TYPEORM_ORDER_ASC },
      });
    } else {
      const fq = this.folderRepo
        .createQueryBuilder('d')
        .where('d.parentId = :folderId', { folderId })
        .andWhere('d.deletedAt IS NULL')
        .orderBy('d.name', TYPEORM_ORDER_ASC)
        .addOrderBy('d.id', TYPEORM_ORDER_ASC)
        .take(folderLimit + 1);

      if (opts.folderCursor) {
        const { n, i } = decodeFolderListCursor(opts.folderCursor);
        fq.andWhere('(d.name > :cName OR (d.name = :cName AND d.id > :cId))', {
          cName: n,
          cId: i,
        });
      }

      const folderRows = await fq.getMany();
      const foldersHasMore = folderRows.length > folderLimit;
      folders = foldersHasMore ? folderRows.slice(0, folderLimit) : folderRows;
      foldersNextCursor =
        foldersHasMore && folders.length > 0
          ? encodeFolderListCursor(folders[folders.length - 1].name, folders[folders.length - 1].id)
          : null;
      foldersLimit = folderLimit;
    }

    const limit = opts?.fileLimit;
    if (!limit) {
      const files = await this.fileRepo.find({
        where: { folderId, deletedAt: IsNull() },
        relations: { tags: true },
        order: { name: TYPEORM_ORDER_ASC },
      });
      return {
        folderId,
        folders,
        files: this.decorateFilesForClient(files),
        ...(foldersNextCursor !== undefined
          ? { foldersNextCursor, foldersLimit }
          : {}),
      };
    }

    const qb = this.fileRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.tags', 'tag')
      .where('f.folderId = :folderId', { folderId })
      .andWhere('f.deletedAt IS NULL')
      .orderBy('f.name', TYPEORM_ORDER_ASC)
      .addOrderBy('f.id', TYPEORM_ORDER_ASC)
      .take(limit + 1);

    if (opts.fileCursor) {
      const { n, i } = decodeFileListCursor(opts.fileCursor);
      qb.andWhere('(f.name > :cName OR (f.name = :cName AND f.id > :cId))', {
        cName: n,
        cId: i,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const files = hasMore ? rows.slice(0, limit) : rows;
    const filesNextCursor =
      hasMore && files.length > 0
        ? encodeFileListCursor(files[files.length - 1].name, files[files.length - 1].id)
        : null;

    return {
      folderId,
      folders,
      files: this.decorateFilesForClient(files),
      ...(foldersNextCursor !== undefined
        ? { foldersNextCursor, foldersLimit }
        : {}),
      filesNextCursor,
      filesLimit: limit,
    };
  }

  /**
   * Chuẩn bị upload async: áp dụng reject | overwrite | suffix, trả tên file cuối cho job.
   */
  async prepareAsyncUpload(
    folderIdParam: string | undefined,
    desiredName: string,
    policy: DuplicateNamePolicy,
  ): Promise<{ finalFileName: string }> {
    const { effectiveName } = await this.resolveUploadTarget(folderIdParam, desiredName, policy);
    return { finalFileName: effectiveName };
  }

  async resolveUploadTarget(
    folderIdParam: string | undefined,
    desiredName: string,
    policy: DuplicateNamePolicy,
  ): Promise<{ folderId: string; effectiveName: string }> {
    const folderId = folderIdParam ? this.resolveFolderId(folderIdParam) : ROOT_FOLDER_ID;
    await this.ensureFolder(folderId);

    const dup = await this.fileRepo.findOne({
      where: { folderId, name: desiredName, deletedAt: IsNull() },
    });
    if (!dup) {
      return { folderId, effectiveName: desiredName };
    }

    if (policy === 'reject') {
      throw new ConflictException(StorageExceptionMessage.FILE_DUPLICATE_NAME);
    }

    if (policy === 'overwrite') {
      await this.removeFileFromDbAndTelegram(dup);
      return { folderId, effectiveName: desiredName };
    }

    const effectiveName = await this.allocateSuffixName(folderId, desiredName);
    return { folderId, effectiveName };
  }

  private splitStemExtension(filename: string): { stem: string; ext: string } {
    const dot = filename.lastIndexOf('.');
    if (dot <= 0 || dot >= filename.length - 1) {
      return { stem: filename, ext: '' };
    }
    return { stem: filename.slice(0, dot), ext: filename.slice(dot) };
  }

  private async allocateSuffixName(folderId: string, desiredName: string): Promise<string> {
    const { stem, ext } = this.splitStemExtension(desiredName);
    for (let n = 1; n <= 9999; n++) {
      const candidate = `${stem} (${n})${ext}`;
      const exists = await this.fileRepo.exist({
        where: { folderId, name: candidate, deletedAt: IsNull() },
      });
      if (!exists) {
        return candidate;
      }
    }
    throw new ConflictException(StorageExceptionMessage.FILE_SUFFIX_EXHAUSTED);
  }

  private async allocateFolderSuffixName(parentId: string, desiredName: string): Promise<string> {
    const exists = await this.folderRepo.exist({
      where: { parentId, name: desiredName, deletedAt: IsNull() },
    });
    if (!exists) return desiredName;
    for (let n = 1; n <= 9999; n++) {
      const candidate = `${desiredName} (${n})`;
      const taken = await this.folderRepo.exist({
        where: { parentId, name: candidate, deletedAt: IsNull() },
      });
      if (!taken) return candidate;
    }
    throw new ConflictException(StorageExceptionMessage.FOLDER_DUPLICATE_NAME);
  }

  private async maybeThumbnail(buffer: Buffer, mime: string): Promise<Buffer | undefined> {
    if (!mime.startsWith(MIME_PREFIX_IMAGE)) {
      return undefined;
    }
    try {
      const out = await sharp(buffer)
        .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      if (out.length > 190 * 1024) {
        return await sharp(buffer)
          .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer();
      }
      return out;
    } catch {
      return undefined;
    }
  }

  private shouldStoreInTelegram(size: number): boolean {
    return size <= TELEGRAM_BACKUP_MAX_BYTES;
  }

  private shouldStoreInMinio(size: number): boolean {
    return size >= TELEGRAM_ONLY_MAX_BYTES;
  }

  private buildMinioObjectKey(fileName: string): string {
    const cleanName = fileName.replace(/[^\w.\-()+ ]+/g, '_').slice(-180) || 'file';
    return `files/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${cleanName}`;
  }

  private async assertMinioCapacity(incomingBytes: number): Promise<void> {
    if (!this.minio.isEnabled()) {
      throw new BadGatewayException('File >= 20MB cần cấu hình MinIO/S3');
    }
    const used = await this.minioUsedBytes();
    const limit = this.minio.limitBytes();
    if (used + incomingBytes > limit) {
      throw new BadRequestException({
        message: 'MinIO đã vượt giới hạn dung lượng',
        usedBytes: used,
        incomingBytes,
        limitBytes: limit,
      });
    }
  }

  private async minioUsedBytes(): Promise<number> {
    const rows = await this.fileRepo
      .createQueryBuilder('f')
      .select('f.s3ObjectKey', 'objectKey')
      .addSelect('MAX(f.size)', 'bytes')
      .where('f.s3ObjectKey IS NOT NULL')
      .groupBy('f.s3ObjectKey')
      .getRawMany<{ objectKey: string; bytes: string }>();
    return rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  }

  private static sha256Buffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private static sha256File(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(path);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  async saveUploadedFile(
    folderIdParam: string | undefined,
    desiredName: string,
    mimeType: string,
    buffer: Buffer,
    policy: DuplicateNamePolicy,
  ): Promise<StoredFile> {
    const { folderId, effectiveName } = await this.resolveUploadTarget(
      folderIdParam,
      desiredName,
      policy,
    );
    return this.persistUploadedDocument(folderId, effectiveName, mimeType, buffer);
  }

  /** Gửi Telegram + lưu DB — gọi sau khi đã xử lý trùng tên (upload sync hoặc worker queue). */
  async persistUploadedDocument(
    folderId: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    opts: PersistUploadOptions = {},
  ): Promise<StoredFile> {
    await this.ensureFolder(folderId);
    const dup = await this.fileRepo.findOne({
      where: { folderId, name: fileName, deletedAt: IsNull() },
    });
    if (dup) {
      fileName = await this.allocateSuffixName(folderId, fileName);
    }

    const size = buffer.length;
    const contentSha256 = StorageService.sha256Buffer(buffer);
    if (!opts.allowDuplicateContent) {
      const existingImage = await this.findActiveImageByContentHash(folderId, mimeType, contentSha256);
      if (existingImage) {
        return StorageService.markSkippedDuplicate(existingImage);
      }
    }
    const objectKey = this.shouldStoreInMinio(size) ? this.buildMinioObjectKey(fileName) : null;
    if (objectKey) {
      await this.assertMinioCapacity(size);
    }

    let uploaded:
      | {
          fileId: string;
          fileUniqueId: string;
          thumbnailFileId?: string | null;
          messageId: number;
        }
      | null = null;
    try {
      if (objectKey) {
        await this.minio.putBuffer({
          objectKey,
          buffer,
          contentType: mimeType,
        });
      }
      if (this.shouldStoreInTelegram(size)) {
        const thumb = await this.maybeThumbnail(buffer, mimeType);
        uploaded = await this.telegram.uploadDocument(buffer, fileName, thumb);
      }
    } catch (err) {
      await this.minio.deleteObject(objectKey).catch(() => undefined);
      throw err;
    }

    const entity = this.fileRepo.create({
      folderId,
      name: fileName,
      mimeType,
      size,
      telegramFileId: uploaded?.fileId ?? null,
      telegramFileUniqueId: uploaded?.fileUniqueId ?? null,
      contentSha256,
      s3Bucket: objectKey ? this.minio.getBucket() : null,
      s3ObjectKey: objectKey,
      thumbnailTelegramFileId: uploaded?.thumbnailFileId ?? null,
      telegramMessageId: uploaded ? String(uploaded.messageId) : null,
    });
    return this.saveFileEntityWithSuffixOnDuplicate(entity, folderId, fileName);
  }

  async persistUploadedDocumentFromPath(
    folderId: string,
    fileName: string,
    mimeType: string,
    path: string,
    size: number,
    opts: PersistUploadOptions = {},
  ): Promise<StoredFile> {
    await this.ensureFolder(folderId);
    const dup = await this.fileRepo.findOne({
      where: { folderId, name: fileName, deletedAt: IsNull() },
    });
    if (dup) {
      fileName = await this.allocateSuffixName(folderId, fileName);
    }

    const contentSha256 = await StorageService.sha256File(path);
    if (!opts.allowDuplicateContent) {
      const existingImage = await this.findActiveImageByContentHash(folderId, mimeType, contentSha256);
      if (existingImage) {
        return StorageService.markSkippedDuplicate(existingImage);
      }
    }
    const objectKey = this.shouldStoreInMinio(size) ? this.buildMinioObjectKey(fileName) : null;
    if (objectKey) {
      await this.assertMinioCapacity(size);
    }

    let uploaded:
      | {
          fileId: string;
          fileUniqueId: string;
          thumbnailFileId?: string | null;
          messageId: number;
        }
      | null = null;
    try {
      if (objectKey) {
        await this.minio.putFileFromPath({
          objectKey,
          path,
          contentType: mimeType,
          contentLength: size,
        });
      }
      if (this.shouldStoreInTelegram(size)) {
        const buffer = await readFile(path);
        const thumb = await this.maybeThumbnail(buffer, mimeType);
        uploaded = await this.telegram.uploadDocument(buffer, fileName, thumb);
      }
    } catch (err) {
      await this.minio.deleteObject(objectKey).catch(() => undefined);
      throw err;
    }

    const entity = this.fileRepo.create({
      folderId,
      name: fileName,
      mimeType,
      size,
      telegramFileId: uploaded?.fileId ?? null,
      telegramFileUniqueId: uploaded?.fileUniqueId ?? null,
      contentSha256,
      s3Bucket: objectKey ? this.minio.getBucket() : null,
      s3ObjectKey: objectKey,
      thumbnailTelegramFileId: uploaded?.thumbnailFileId ?? null,
      telegramMessageId: uploaded ? String(uploaded.messageId) : null,
    });
    return this.saveFileEntityWithSuffixOnDuplicate(entity, folderId, fileName);
  }

  async searchFiles(params: FileSearchParams): Promise<StoredFile[]> {
    const limit = Math.min(Math.max(params.limit, 1), 200);
    const qb = this.fileRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.tags', 'tag')
      .where('f.deletedAt IS NULL')
      .orderBy('f.name', TYPEORM_ORDER_ASC)
      .addOrderBy('f.id', TYPEORM_ORDER_ASC)
      .take(limit);

    if (params.q?.trim()) {
      const escaped = params.q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const pat = params.mode === 'prefix' ? `${escaped}%` : `%${escaped}%`;
      qb.andWhere('f.name LIKE :pat ESCAPE :esc', {
        pat,
        esc: '\\',
      });
    }

    if (params.folderId !== undefined && params.folderId !== '') {
      const fid = this.resolveFolderId(params.folderId);
      await this.ensureFolder(fid);
      qb.andWhere('f.folderId = :fid', { fid });
    }
    if (params.mimeType?.trim()) {
      qb.andWhere('f.mimeType = :mimeType', { mimeType: params.mimeType.trim() });
    }
    if (params.mimePrefix?.trim()) {
      qb.andWhere('f.mimeType LIKE :mimePrefix', { mimePrefix: `${params.mimePrefix.trim()}%` });
    }
    if (params.minSize !== undefined) {
      qb.andWhere('f.size >= :minSize', { minSize: params.minSize });
    }
    if (params.maxSize !== undefined) {
      qb.andWhere('f.size <= :maxSize', { maxSize: params.maxSize });
    }
    if (params.createdFrom) {
      qb.andWhere('f.createdAt >= :createdFrom', { createdFrom: new Date(params.createdFrom) });
    }
    if (params.createdTo) {
      qb.andWhere('f.createdAt <= :createdTo', { createdTo: new Date(params.createdTo) });
    }
    if (params.hasThumbnail === true) {
      qb.andWhere('f.thumbnailTelegramFileId IS NOT NULL');
    }
    if (params.hasThumbnail === false) {
      qb.andWhere('f.thumbnailTelegramFileId IS NULL');
    }
    const tags = StorageService.normalizeTags(params.tags ?? []);
    tags.forEach((tagName, idx) => {
      const alias = `filterTag${idx}`;
      qb.innerJoin('f.tags', alias, `${alias}.name = :tag${idx}`, {
        [`tag${idx}`]: tagName,
      });
    });

    return qb.getMany();
  }

  async patchFile(
    id: string,
    dto: { name?: string; folderId?: string },
    policy: DuplicateNamePolicy,
  ): Promise<StoredFile> {
    const file = await this.getFile(id);

    let targetFolderId = file.folderId;
    if (dto.folderId !== undefined) {
      targetFolderId = dto.folderId;
      await this.ensureFolder(targetFolderId);
    }

    let targetName = dto.name ?? file.name;

    if (targetFolderId === file.folderId && targetName === file.name) {
      return file;
    }

    let dup = await this.fileRepo.findOne({
      where: { folderId: targetFolderId, name: targetName, deletedAt: IsNull() },
    });
    if (dup?.id === file.id) {
      dup = null;
    }

    if (dup) {
      if (policy === 'reject') {
        throw new ConflictException(StorageExceptionMessage.FILE_DUPLICATE_NAME);
      }
      if (policy === 'overwrite') {
        await this.removeFileFromDbAndTelegram(dup);
      } else {
        targetName = await this.allocateSuffixName(targetFolderId, targetName);
      }
    }

    file.folderId = targetFolderId;
    file.name = targetName;
    return this.fileRepo.save(file);
  }

  async getStorageQuotaStats(): Promise<StorageQuotaStats> {
    const active = await this.fileRepo
      .createQueryBuilder('f')
      .select('COUNT(*)', 'files')
      .addSelect('COALESCE(SUM(f.size), 0)', 'bytes')
      .where('f.deletedAt IS NULL')
      .andWhere('f.telegramFileId IS NOT NULL')
      .getRawOne<{ files: string; bytes: string }>();

    const trashed = await this.fileRepo
      .createQueryBuilder('f')
      .select('COUNT(*)', 'files')
      .addSelect('COALESCE(SUM(f.size), 0)', 'bytes')
      .where('f.deletedAt IS NOT NULL')
      .andWhere('f.telegramFileId IS NOT NULL')
      .getRawOne<{ files: string; bytes: string }>();

    const byMimeTypeRaw = await this.fileRepo
      .createQueryBuilder('f')
      .select('f.mimeType', 'mimeType')
      .addSelect('COUNT(*)', 'files')
      .addSelect('COALESCE(SUM(f.size), 0)', 'bytes')
      .where('f.deletedAt IS NULL')
      .andWhere('f.telegramFileId IS NOT NULL')
      .groupBy('f.mimeType')
      .orderBy('bytes', 'DESC')
      .limit(50)
      .getRawMany<{ mimeType: string; files: string; bytes: string }>();

    const totalFolders = await this.folderRepo.count({
      where: { id: Not(ROOT_FOLDER_ID), deletedAt: IsNull() },
    });
    const minioBytes = await this.minioUsedBytes();

    return {
      totalFiles: Number(active?.files ?? 0),
      totalFolders,
      totalBytes: Number(active?.bytes ?? 0),
      trashedFiles: Number(trashed?.files ?? 0),
      trashedBytes: Number(trashed?.bytes ?? 0),
      minioBytes,
      minioLimitBytes: this.minio.limitBytes(),
      byMimeType: byMimeTypeRaw.map((row) => ({
        mimeType: row.mimeType,
        files: Number(row.files),
        bytes: Number(row.bytes),
      })),
    };
  }

  async setFileTags(id: string, rawTags: string[]): Promise<StoredFile> {
    const file = await this.getFile(id);
    const names = StorageService.normalizeTags(rawTags);
    const tags: FileTag[] = [];
    for (const name of names) {
      let tag = await this.tagRepo.findOne({ where: { name } });
      if (!tag) {
        tag = await this.tagRepo.save(this.tagRepo.create({ name }));
      }
      tags.push(tag);
    }
    file.tags = tags;
    return this.fileRepo.save(file);
  }

  async getFileTags(id: string): Promise<string[]> {
    const file = await this.getFile(id);
    return StorageService.tagsToNames(file);
  }

  async deleteFile(id: string): Promise<void> {
    const f = await this.getFile(id);
    f.deletedAt = new Date();
    f.deletedOriginalFolderId = f.folderId;
    f.deletedOriginalName = f.name;
    f.name = this.buildTrashFileName(f);
    await this.fileRepo.save(f);
  }

  async listTrashedFiles(limit = 100): Promise<StoredFile[]> {
    return this.fileRepo.find({
      where: { deletedAt: Not(IsNull()) },
      relations: { tags: true },
      order: { deletedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async listTrashedFolders(limit = 100): Promise<Folder[]> {
    return this.folderRepo.find({
      where: { deletedAt: Not(IsNull()) },
      order: { deletedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async listTrashFolderContents(folderId: string): Promise<{
    folderId: string;
    folders: Folder[];
    files: StoredFile[];
  }> {
    const folder = await this.folderRepo.findOne({ where: { id: folderId } });
    if (!folder || !(await this.isFolderInTrashBranch(folder))) {
      throw new NotFoundException(StorageExceptionMessage.FOLDER_NOT_FOUND);
    }

    const [folders, files] = await Promise.all([
      this.folderRepo.find({
        where: { parentId: folderId },
        order: { name: TYPEORM_ORDER_ASC },
      }),
      this.fileRepo.find({
        where: { folderId },
        relations: { tags: true },
        order: { name: TYPEORM_ORDER_ASC },
      }),
    ]);

    return {
      folderId,
      folders,
      files: this.decorateFilesForClient(files),
    };
  }

  async restoreFile(id: string, policy: DuplicateNamePolicy): Promise<StoredFile> {
    const file = await this.getTrashedFile(id);
    let targetFolderId = file.deletedOriginalFolderId ?? file.folderId;
    const targetFolderExists = await this.folderRepo.exist({ where: { id: targetFolderId } });
    if (!targetFolderExists) {
      targetFolderId = ROOT_FOLDER_ID;
    }
    let targetName = file.deletedOriginalName ?? file.name;
    const dup = await this.fileRepo.findOne({
      where: { folderId: targetFolderId, name: targetName, deletedAt: IsNull() },
    });
    if (dup) {
      if (policy === 'reject') {
        throw new ConflictException(StorageExceptionMessage.FILE_DUPLICATE_NAME);
      }
      if (policy === 'overwrite') {
        await this.removeFileFromDbAndTelegram(dup);
      } else {
        targetName = await this.allocateSuffixName(targetFolderId, targetName);
      }
    }

    file.folderId = targetFolderId;
    file.name = targetName;
    file.deletedAt = null;
    file.deletedOriginalFolderId = null;
    file.deletedOriginalName = null;
    return this.saveFileEntityWithSuffixOnDuplicate(file, targetFolderId, targetName);
  }

  async permanentlyDeleteFile(id: string): Promise<void> {
    const file = await this.getTrashedFile(id);
    await this.removeFileFromDbAndTelegram(file);
  }

  async restoreFolder(id: string): Promise<Folder> {
    const folder = await this.getTrashedFolder(id);
    let targetParentId = folder.deletedOriginalParentId ?? ROOT_FOLDER_ID;
    const targetParentExists = await this.folderRepo.exist({
      where: { id: targetParentId, deletedAt: IsNull() },
    });
    if (!targetParentExists) {
      targetParentId = ROOT_FOLDER_ID;
    }
    folder.parentId = targetParentId;
    folder.name = await this.allocateFolderSuffixName(
      targetParentId,
      folder.deletedOriginalName ?? folder.name,
    );
    folder.deletedAt = null;
    folder.deletedOriginalParentId = null;
    folder.deletedOriginalName = null;
    return this.folderRepo.save(folder);
  }

  async permanentlyDeleteFolder(id: string): Promise<void> {
    const folder = await this.getTrashedFolder(id);
    await this.hardDeleteFolderBranch(folder.id);
  }

  async emptyTrash(): Promise<void> {
    const files = await this.fileRepo.find({ where: { deletedAt: Not(IsNull()) } });
    for (const file of files) {
      await this.removeFileFromDbAndTelegram(file);
    }
    const folders = await this.folderRepo.find({ where: { deletedAt: Not(IsNull()) } });
    for (const folder of folders) {
      await this.hardDeleteFolderBranch(folder.id);
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    if (folderId === ROOT_FOLDER_ID) {
      throw new BadRequestException(
        StorageExceptionMessage.ROOT_FOLDER_DELETE_FORBIDDEN,
      );
    }
    const folder = await this.ensureFolder(folderId);
    folder.deletedAt = new Date();
    folder.deletedOriginalParentId = folder.parentId;
    folder.deletedOriginalName = folder.name;
    folder.parentId = ROOT_FOLDER_ID;
    folder.name = this.buildTrashFolderName(folder);
    await this.folderRepo.save(folder);
  }

  private async removeFileFromDbAndTelegram(f: StoredFile): Promise<void> {
    const msgId = f.telegramMessageId;
    if (msgId != null && msgId !== '') {
      const cnt = await this.fileRepo.count({
        where: { telegramMessageId: msgId },
      });
      if (cnt <= 1) {
        await this.telegram.deleteChatMessage(msgId);
      }
    }
    const objectKey = f.s3ObjectKey;
    if (objectKey) {
      const cnt = await this.fileRepo.count({
        where: { s3ObjectKey: objectKey },
      });
      if (cnt <= 1) {
        await this.minio.deleteObject(objectKey);
      }
    }
    await this.fileRepo.remove(f);
  }

  async getFile(id: string): Promise<StoredFile> {
    const file = await this.fileRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { tags: true },
    });
    if (!file) {
      throw new NotFoundException(StorageExceptionMessage.FILE_NOT_FOUND);
    }
    return file;
  }

  async getFileForRead(id: string, includeTrashed = false): Promise<StoredFile> {
    return includeTrashed ? this.getTrashedFile(id) : this.getFile(id);
  }

  async findActiveFileByName(folderId: string, name: string): Promise<StoredFile | null> {
    return this.fileRepo.findOne({
      where: { folderId, name, deletedAt: IsNull() },
      relations: { tags: true },
    });
  }

  async allocateFileSuffixName(folderId: string, desiredName: string): Promise<string> {
    return this.allocateSuffixName(folderId, desiredName);
  }

  private async saveFileEntityWithSuffixOnDuplicate(
    entity: StoredFile,
    folderId: string,
    desiredName: string,
  ): Promise<StoredFile> {
    try {
      return await this.fileRepo.save(entity);
    } catch (err) {
      if (!StorageService.isDuplicateEntryError(err)) {
        throw err;
      }
      entity.name = await this.allocateSuffixName(folderId, desiredName);
      return this.fileRepo.save(entity);
    }
  }

  private static isDuplicateEntryError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) {
      return false;
    }
    const maybe = err as { code?: string; errno?: number; message?: string };
    return (
      maybe.code === 'ER_DUP_ENTRY' ||
      maybe.errno === 1062 ||
      String(maybe.message || '').includes('Duplicate entry')
    );
  }

  private async findActiveImageByContentHash(
    folderId: string,
    mimeType: string,
    contentSha256: string,
  ): Promise<StoredFile | null> {
    if (!mimeType.startsWith(MIME_PREFIX_IMAGE)) {
      return null;
    }
    return this.fileRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.tags', 'tag')
      .where('f.deletedAt IS NULL')
      .andWhere('f.folderId = :folderId', { folderId })
      .andWhere('f.contentSha256 = :contentSha256', { contentSha256 })
      .andWhere('f.mimeType LIKE :imagePrefix', { imagePrefix: `${MIME_PREFIX_IMAGE}%` })
      .orderBy('f.createdAt', TYPEORM_ORDER_ASC)
      .addOrderBy('f.id', TYPEORM_ORDER_ASC)
      .getOne();
  }

  private static markSkippedDuplicate(file: StoredFile): StoredFile {
    Object.assign(file, {
      skippedDuplicate: true,
      skippedDuplicateReason: 'Ảnh đã tồn tại trong thư mục',
    });
    return file;
  }

  private async getTrashedFile(id: string): Promise<StoredFile> {
    const file = await this.fileRepo.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      relations: { tags: true },
    });
    if (!file) {
      throw new NotFoundException(StorageExceptionMessage.FILE_NOT_FOUND);
    }
    return file;
  }

  private async getTrashedFolder(id: string): Promise<Folder> {
    const folder = await this.folderRepo.findOne({
      where: { id, deletedAt: Not(IsNull()) },
    });
    if (!folder) {
      throw new NotFoundException(StorageExceptionMessage.FOLDER_NOT_FOUND);
    }
    return folder;
  }

  private async isFolderInTrashBranch(folder: Folder): Promise<boolean> {
    let current: Folder | null = folder;
    const visited = new Set<string>();
    while (current) {
      if (current.deletedAt) {
        return true;
      }
      if (!current.parentId || current.parentId === ROOT_FOLDER_ID || visited.has(current.parentId)) {
        return false;
      }
      visited.add(current.parentId);
      current = await this.folderRepo.findOne({ where: { id: current.parentId } });
    }
    return false;
  }

  private buildTrashFileName(file: StoredFile): string {
    const suffix = `.trash-${Date.now()}-${file.id.slice(0, 8)}-`;
    return `${suffix}${file.name}`.slice(0, 255);
  }

  private buildTrashFolderName(folder: Folder): string {
    const suffix = `.trash-${Date.now()}-${folder.id.slice(0, 8)}-`;
    return `${suffix}${folder.name}`.slice(0, 255);
  }

  private async hardDeleteFolderBranch(folderId: string): Promise<void> {
    const children = await this.folderRepo.find({
      where: { parentId: folderId },
      order: { name: TYPEORM_ORDER_ASC },
    });
    for (const child of children) {
      await this.hardDeleteFolderBranch(child.id);
    }
    const files = await this.fileRepo.find({
      where: { folderId },
      order: { name: TYPEORM_ORDER_ASC },
    });
    for (const file of files) {
      await this.removeFileFromDbAndTelegram(file);
    }
    await this.folderRepo.delete({ id: folderId });
  }

  /** Stream file gốc từ Telegram ra Express response (download / view / link chia sẻ). */
  async streamOriginalToExpressResponse(
    storedFileId: string,
    res: Response,
    disposition: (typeof ContentDispositionMode)[keyof typeof ContentDispositionMode],
    opts: { includeTrashed?: boolean } = {},
  ): Promise<void> {
    const f = await this.getFileForRead(storedFileId, opts.includeTrashed);
    if (f.s3ObjectKey) {
      try {
        const object = await this.minio.getObject(f.s3ObjectKey);
        res.setHeader(HttpHeader.CONTENT_TYPE, object.contentType || f.mimeType);
        res.setHeader('Content-Length', String(object.contentLength ?? f.size));
        if (disposition === ContentDispositionMode.INLINE) {
          res.setHeader(HttpHeader.CACHE_CONTROL, CacheControlValue.PRIVATE_MONTH);
        }
        res.setHeader(
          HttpHeader.CONTENT_DISPOSITION,
          contentDispositionHeader(disposition, f.name),
        );
        object.body.pipe(res);
        return;
      } catch (err) {
        if (!f.telegramFileId) {
          throw err;
        }
      }
    }
    if (!f.telegramFileId) {
      throw new BadGatewayException('File không có bản Telegram để tải dự phòng');
    }
    let r: globalThis.Response;
    try {
      r = await this.fetchTelegramFileResponse(f.telegramFileId);
    } catch (err) {
      if (StorageService.isTelegramFileTooBigError(err)) {
        const url = StorageService.telegramMessageUrl(f.telegramMessageId);
        if (url) {
          res.redirect(url);
          return;
        }
      }
      throw err;
    }
    res.setHeader(HttpHeader.CONTENT_TYPE, f.mimeType);
    res.setHeader('Content-Length', String(f.size));
    if (disposition === ContentDispositionMode.INLINE) {
      res.setHeader(HttpHeader.CACHE_CONTROL, CacheControlValue.PRIVATE_MONTH);
    }
    res.setHeader(
      HttpHeader.CONTENT_DISPOSITION,
      contentDispositionHeader(disposition, f.name),
    );
    Readable.fromWeb(r.body as import('stream/web').ReadableStream).pipe(res);
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    return this.telegram.getFileDownloadUrl(fileId);
  }

  async fetchTelegramFileResponse(fileId: string): Promise<globalThis.Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = await this.getDownloadUrl(fileId);
        const response = await StorageService.fetchTelegramUrl(url);
        if (response.ok && response.body) {
          return response;
        }
        lastError = new Error(`Telegram file response ${response.status}`);
      } catch (err) {
        lastError = err;
      }
      await StorageService.sleep(250 * (attempt + 1));
    }
    throw new BadGatewayException({
      message: ApiExceptionMessage.TELEGRAM_FILE_DOWNLOAD_FAILED,
      detail: StorageService.errorDetail(lastError),
    });
  }

  /** Chuẩn bị danh sách entry ZIP + tên file — dùng sync stream và worker folder-zip. */
  async prepareFolderZipArchive(folderIdParam: string): Promise<{
    entries: Array<{ zipPath: string; telegramFileId: string | null; s3ObjectKey: string | null }>;
    zipBaseName: string;
  }> {
    const folderId = this.resolveFolderId(folderIdParam);
    const folder = await this.ensureFolder(folderId);
    const maxFiles = this.readFolderZipMaxFilesCap();
    const entries = await this.collectDescendantFilesForZip(folderId, '');
    if (entries.length > maxFiles) {
      throw new BadRequestException({
        message: ApiExceptionMessage.FOLDER_ZIP_TOO_MANY_FILES,
        maxFiles,
        found: entries.length,
      });
    }
    return {
      entries,
      zipBaseName: StorageService.zipArchiveBasename(folder),
    };
  }

  /** Ghi ZIP ra đĩa (worker queue). */
  async writeFolderZipToDisk(
    entries: Array<{ zipPath: string; telegramFileId: string | null; s3ObjectKey: string | null }>,
    zipBaseName: string,
    absoluteZipPath: string,
  ): Promise<void> {
    await mkdir(dirname(absoluteZipPath), { recursive: true });
    const output = createWriteStream(absoluteZipPath);
    const archive = createZipArchive();
    archive.pipe(output);

    try {
      for (const e of entries) {
        if (e.s3ObjectKey) {
          const object = await this.minio.getObject(e.s3ObjectKey);
          archive.append(object.body, { name: e.zipPath });
        } else if (e.telegramFileId) {
          const r = await this.fetchTelegramFileResponse(e.telegramFileId);
          archive.append(Readable.fromWeb(r.body as import('stream/web').ReadableStream), {
            name: e.zipPath,
          });
        }
      }
      await archive.finalize();
      await finished(output);
    } catch (err) {
      archive.abort();
      output.destroy();
      await unlink(absoluteZipPath).catch(() => undefined);
      throw err;
    }
  }

  /** Stream file ZIP đã build (tải token async); xóa file sau khi stream xong. */
  async streamZipFileToResponse(
    absoluteZipPath: string,
    zipBaseName: string,
    res: Response,
  ): Promise<void> {
    res.setHeader(HttpHeader.CONTENT_TYPE, MimeType.APPLICATION_ZIP);
    res.setHeader(
      HttpHeader.CONTENT_DISPOSITION,
      contentDispositionHeader(ContentDispositionMode.ATTACHMENT, `${zipBaseName}.zip`),
    );
    const rs = createReadStream(absoluteZipPath);
    rs.once('error', () => {
      void unlink(absoluteZipPath).catch(() => undefined);
    });
    res.once('close', () => {
      void unlink(absoluteZipPath).catch(() => undefined);
    });
    rs.once('end', () => {
      void unlink(absoluteZipPath).catch(() => undefined);
    });
    rs.pipe(res);
  }

  /** Tải cả cây thư mục dưới dạng ZIP (đệ quy). Tuần tự từ Telegram — có thể chậm với nhiều file. */
  async streamFolderZipToResponse(folderIdParam: string, res: Response): Promise<void> {
    const { entries, zipBaseName } = await this.prepareFolderZipArchive(folderIdParam);

    res.setHeader(HttpHeader.CONTENT_TYPE, MimeType.APPLICATION_ZIP);
    res.setHeader(
      HttpHeader.CONTENT_DISPOSITION,
      contentDispositionHeader(ContentDispositionMode.ATTACHMENT, `${zipBaseName}.zip`),
    );

    const archive = createZipArchive();

    await new Promise<void>((resolve, reject) => {
      archive.once('error', reject);
      archive.pipe(res);
      void (async () => {
        try {
          for (const e of entries) {
            if (e.s3ObjectKey) {
              const object = await this.minio.getObject(e.s3ObjectKey);
              archive.append(object.body, { name: e.zipPath });
            } else if (e.telegramFileId) {
              const r = await this.fetchTelegramFileResponse(e.telegramFileId);
              archive.append(Readable.fromWeb(r.body as import('stream/web').ReadableStream), {
                name: e.zipPath,
              });
            }
          }
          await archive.finalize();
          resolve();
        } catch (err) {
          archive.abort();
          reject(err);
        }
      })();
    });
  }

  async copyFolderBranch(
    sourceFolderId: string,
    targetParentIdParam: string | undefined,
  ): Promise<Folder> {
    if (sourceFolderId === ROOT_FOLDER_ID) {
      throw new BadRequestException(ApiExceptionMessage.FOLDER_COPY_ROOT_FORBIDDEN);
    }
    const src = await this.ensureFolder(sourceFolderId);
    const targetParentId = targetParentIdParam
      ? this.resolveFolderId(targetParentIdParam)
      : ROOT_FOLDER_ID;
    await this.ensureFolder(targetParentId);
    await this.assertTargetParentOutsideSourceSubtree(sourceFolderId, targetParentId);

    const sibling = await this.folderRepo.findOne({
      where: { parentId: targetParentId, name: src.name },
    });
    if (sibling) {
      throw new ConflictException(StorageExceptionMessage.FOLDER_DUPLICATE_NAME);
    }

    const rootCopy = await this.folderRepo.save(
      this.folderRepo.create({ parentId: targetParentId, name: src.name }),
    );

    const queue: Array<{ srcId: string; dstId: string }> = [
      { srcId: sourceFolderId, dstId: rootCopy.id },
    ];

    while (queue.length > 0) {
      const pair = queue.pop();
      if (!pair) break;
      const { srcId, dstId } = pair;

      const files = await this.fileRepo.find({
        where: { folderId: srcId, deletedAt: IsNull() },
        relations: { tags: true },
        order: { name: TYPEORM_ORDER_ASC },
      });
      for (const f of files) {
        await this.fileRepo.save(
          this.fileRepo.create({
            folderId: dstId,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size,
            telegramFileId: f.telegramFileId,
            telegramFileUniqueId: f.telegramFileUniqueId,
            contentSha256: f.contentSha256,
            s3Bucket: f.s3Bucket,
            s3ObjectKey: f.s3ObjectKey,
            thumbnailTelegramFileId: f.thumbnailTelegramFileId,
            telegramMessageId: f.telegramMessageId,
            tags: f.tags,
          }),
        );
      }

      const subs = await this.folderRepo.find({
        where: { parentId: srcId },
        order: { name: TYPEORM_ORDER_ASC },
      });
      for (const sub of subs) {
        const clash = await this.folderRepo.findOne({
          where: { parentId: dstId, name: sub.name },
        });
        if (clash) {
          throw new ConflictException(StorageExceptionMessage.FOLDER_DUPLICATE_NAME);
        }
        const nf = await this.folderRepo.save(
          this.folderRepo.create({ parentId: dstId, name: sub.name }),
        );
        queue.push({ srcId: sub.id, dstId: nf.id });
      }
    }

    return rootCopy;
  }

  async moveFolder(folderId: string, targetParentIdParam: string): Promise<Folder> {
    if (folderId === ROOT_FOLDER_ID) {
      throw new BadRequestException(StorageExceptionMessage.ROOT_FOLDER_DELETE_FORBIDDEN);
    }
    const folder = await this.ensureFolder(folderId);
    const targetParentId = this.resolveFolderId(targetParentIdParam);
    if (targetParentId === folder.parentId) {
      return folder;
    }
    await this.ensureFolder(targetParentId);
    await this.assertTargetParentOutsideSourceSubtree(folderId, targetParentId);

    const sibling = await this.folderRepo.findOne({
      where: { parentId: targetParentId, name: folder.name },
    });
    if (sibling && sibling.id !== folder.id) {
      throw new ConflictException(StorageExceptionMessage.FOLDER_DUPLICATE_NAME);
    }

    folder.parentId = targetParentId;
    return this.folderRepo.save(folder);
  }

  async findDuplicateFileGroups(): Promise<
    Array<{ telegramFileUniqueId: string | null; contentSha256: string | null; files: StoredFile[] }>
  > {
    const hashRows = await this.fileRepo
      .createQueryBuilder('f')
      .select('f.contentSha256', 'contentSha256')
      .addSelect('COUNT(*)', 'cnt')
      .where('f.deletedAt IS NULL')
      .andWhere('f.contentSha256 IS NOT NULL')
      .groupBy('f.contentSha256')
      .having('COUNT(*) > :n', { n: 1 })
      .getRawMany<{ contentSha256: string }>();

    const telegramRows = await this.fileRepo
      .createQueryBuilder('f')
      .select('f.telegramFileUniqueId', 'telegramFileUniqueId')
      .addSelect('COUNT(*)', 'cnt')
      .where('f.deletedAt IS NULL')
      .andWhere('f.contentSha256 IS NULL')
      .andWhere('f.telegramFileUniqueId IS NOT NULL')
      .groupBy('f.telegramFileUniqueId')
      .having('COUNT(*) > :n', { n: 1 })
      .getRawMany<{ telegramFileUniqueId: string }>();

    const groups: Array<{
      telegramFileUniqueId: string | null;
      contentSha256: string | null;
      files: StoredFile[];
    }> = [];
    for (const r of hashRows) {
      const files = await this.fileRepo.find({
        where: { contentSha256: r.contentSha256, deletedAt: IsNull() },
        relations: { tags: true },
        order: { createdAt: TYPEORM_ORDER_ASC },
      });
      groups.push({ telegramFileUniqueId: files[0]?.telegramFileUniqueId ?? null, contentSha256: r.contentSha256, files });
    }
    for (const r of telegramRows) {
      const files = await this.fileRepo.find({
        where: { telegramFileUniqueId: r.telegramFileUniqueId, deletedAt: IsNull() },
        relations: { tags: true },
        order: { createdAt: TYPEORM_ORDER_ASC },
      });
      groups.push({ telegramFileUniqueId: r.telegramFileUniqueId, contentSha256: null, files });
    }
    return groups;
  }

  async deleteDuplicateFiles(): Promise<{
    groups: number;
    deleted: number;
    files: StoredFile[];
  }> {
    const groups = await this.findDuplicateFileGroups();
    const deletedFiles: StoredFile[] = [];
    for (const group of groups) {
      const [, ...duplicates] = group.files;
      for (const duplicate of duplicates) {
        await this.deleteFile(duplicate.id);
        const trashed = await this.getTrashedFile(duplicate.id);
        deletedFiles.push(trashed);
      }
    }
    return {
      groups: groups.length,
      deleted: deletedFiles.length,
      files: deletedFiles,
    };
  }

  async getFilesMetaBatch(ids: string[]): Promise<
    Array<{
      id: string;
      name: string;
      mimeType: string;
      size: number;
      folderId: string;
      createdAt: Date;
      hasThumbnail: boolean;
      tags?: string[];
    }>
  > {
    if (ids.length > 100) {
      throw new BadRequestException(ApiExceptionMessage.META_BATCH_TOO_MANY_IDS);
    }
    const uniq = [...new Set(ids)];
    if (uniq.length === 0) {
      return [];
    }
    const files = await this.fileRepo.find({
      where: { id: In(uniq), deletedAt: IsNull() },
      relations: { tags: true },
    });
    const map = new Map(files.map((f) => [f.id, f]));
    return uniq
      .map((id) => map.get(id))
      .filter((f): f is StoredFile => f !== undefined)
      .map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        folderId: f.folderId,
        createdAt: f.createdAt instanceof Date ? f.createdAt : new Date(f.createdAt as string),
        hasThumbnail: !!f.thumbnailTelegramFileId,
        tags: StorageService.tagsToNames(f),
      }));
  }

  async ingestInboundTelegramDocument(params: {
    messageId: number;
    document: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    thumbnailFileId: string | null;
  }): Promise<StoredFile | null> {
    const mid = String(params.messageId);
    const existing = await this.fileRepo.findOne({
      where: { telegramMessageId: mid, deletedAt: IsNull() },
    });
    if (existing) {
      return null;
    }

    const syncFolderRaw = this.config.get<string>(EnvKey.TELEGRAM_SYNC_FOLDER_ID)?.trim();
    const folderId = syncFolderRaw
      ? this.resolveFolderId(syncFolderRaw)
      : ROOT_FOLDER_ID;
    await this.ensureFolder(folderId);

    const baseName =
      params.document.file_name?.trim() ||
      `telegram_${params.document.file_unique_id}`;
    const fileName = await this.uniqueInboundFileName(folderId, baseName);

    const entity = this.fileRepo.create({
      folderId,
      name: fileName,
      mimeType: params.document.mime_type ?? MimeType.OCTET_STREAM,
      size: params.document.file_size ?? 0,
      telegramFileId: params.document.file_id,
      telegramFileUniqueId: params.document.file_unique_id,
      thumbnailTelegramFileId: params.thumbnailFileId,
      telegramMessageId: mid,
    });
    return this.fileRepo.save(entity);
  }

  /** Đường dẫn tuyệt đối file ZIP khi build queue — worker gọi. */
  resolveFolderZipOutputPath(jobId: string): string {
    const baseDir =
      this.config.get<string>(EnvKey.UPLOAD_TMP_DIR)?.trim() ||
      join(process.cwd(), 'tmp', 'uploads');
    return join(baseDir, 'folder-zip', `${jobId}.zip`);
  }

  private async assertTargetParentOutsideSourceSubtree(
    sourceFolderId: string,
    targetParentId: string,
  ): Promise<void> {
    let cur: string | null = targetParentId;
    while (cur !== null) {
      if (cur === sourceFolderId) {
        throw new BadRequestException(
          ApiExceptionMessage.FOLDER_COPY_TARGET_INSIDE_SOURCE,
        );
      }
      const folder = await this.folderRepo.findOne({ where: { id: cur } });
      cur = folder?.parentId ?? null;
    }
  }

  private async uniqueInboundFileName(folderId: string, baseName: string): Promise<string> {
    const exists = await this.fileRepo.exist({
      where: { folderId, name: baseName, deletedAt: IsNull() },
    });
    if (!exists) {
      return baseName;
    }
    return this.allocateSuffixName(folderId, baseName);
  }

  private readFolderZipMaxFilesCap(): number {
    const raw = this.config.get<string>(EnvKey.FOLDER_ZIP_MAX_FILES)?.trim();
    const n = raw !== undefined && raw !== '' ? Number(raw) : NaN;
    if (!Number.isFinite(n) || n < 1) {
      return 2000;
    }
    return Math.min(Math.floor(n), 50000);
  }

  private async collectDescendantFilesForZip(
    folderId: string,
    relativePath: string,
  ): Promise<Array<{ zipPath: string; telegramFileId: string | null; s3ObjectKey: string | null }>> {
    const out: Array<{
      zipPath: string;
      telegramFileId: string | null;
      s3ObjectKey: string | null;
    }> = [];

    const files = await this.fileRepo.find({
      where: { folderId, deletedAt: IsNull() },
      order: { name: TYPEORM_ORDER_ASC },
    });
    for (const f of files) {
      const safeFile = StorageService.sanitizeZipPathSegment(f.name);
      out.push({
        zipPath: `${relativePath}${safeFile}`,
        telegramFileId: f.telegramFileId,
        s3ObjectKey: f.s3ObjectKey,
      });
    }

    const subfolders = await this.folderRepo.find({
      where: { parentId: folderId },
      order: { name: TYPEORM_ORDER_ASC },
    });
    for (const sub of subfolders) {
      const safeDir = StorageService.sanitizeZipPathSegment(sub.name);
      const prefix = `${relativePath}${safeDir}/`;
      out.push(...(await this.collectDescendantFilesForZip(sub.id, prefix)));
    }

    return out;
  }

  private static sanitizeZipPathSegment(segment: string): string {
    const cleaned = segment.replace(/[\x00-\x1f\\/]/g, '_').trim();
    if (cleaned === '' || cleaned === '.' || cleaned === '..') {
      return '_';
    }
    return cleaned;
  }

  static normalizeTags(tags: string[]): string[] {
    return [
      ...new Set(
        tags
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0)
          .map((tag) => tag.slice(0, 80)),
      ),
    ].slice(0, 20);
  }

  static tagsToNames(file: StoredFile): string[] {
    return (file.tags ?? []).map((tag) => tag.name).sort((a, b) => a.localeCompare(b));
  }

  private decorateFilesForClient(files: StoredFile[]): StoredFile[] {
    return files.map((file) => {
      Object.assign(file, {
        tags: StorageService.tagsToNames(file),
        canDirectDownload: !!file.s3ObjectKey || (!!file.telegramFileId && file.size <= telegramDownloadMaxBytes()),
        telegramMessageUrl: StorageService.telegramMessageUrl(file.telegramMessageId),
      });
      return file;
    });
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static async fetchTelegramUrl(url: string): Promise<globalThis.Response> {
    try {
      return await fetch(url);
    } catch {
      return StorageService.fetchTelegramUrlWithHttps(url);
    }
  }

  private static fetchTelegramUrlWithHttps(url: string): Promise<globalThis.Response> {
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          family: 4,
          timeout: 30000,
        },
        (res) => {
          const headers = new Headers();
          Object.entries(res.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              headers.set(key, value.join(', '));
              return;
            }
            if (value !== undefined) {
              headers.set(key, String(value));
            }
          });
          resolve(
            new globalThis.Response(
              Readable.toWeb(res) as ReadableStream<Uint8Array>,
              {
                status: res.statusCode ?? 502,
                statusText: res.statusMessage,
                headers,
              },
            ),
          );
        },
      );
      req.on('timeout', () => req.destroy(new Error('Telegram HTTPS timeout')));
      req.on('error', reject);
      req.end();
    });
  }

  private static errorDetail(err: unknown): string {
    if (!(err instanceof Error)) {
      return String(err);
    }
    const cause =
      'cause' in err && err.cause instanceof Error
        ? ` (${err.cause.message})`
        : '';
    return `${err.message}${cause}`;
  }

  private static isTelegramFileTooBigError(err: unknown): boolean {
    const raw =
      err instanceof BadGatewayException
        ? JSON.stringify(err.getResponse())
        : err instanceof Error
          ? err.message
          : String(err);
    return raw.includes('file is too big');
  }

  private static telegramMessageUrl(messageId: string | null | undefined): string | undefined {
    if (!messageId) {
      return undefined;
    }
    const chat = process.env[EnvKey.TELEGRAM_STORAGE_CHAT_ID]?.trim();
    if (!chat) {
      return undefined;
    }
    if (chat.startsWith('@')) {
      return `https://t.me/${chat.slice(1)}/${messageId}`;
    }
    if (chat.startsWith('-100')) {
      return `https://t.me/c/${chat.slice(4)}/${messageId}`;
    }
    return undefined;
  }

  private static zipArchiveBasename(folder: Folder): string {
    const raw = folder.id === ROOT_FOLDER_ID ? StorageService.dateStampedDataName() : folder.name;
    const base = StorageService.sanitizeZipPathSegment(raw).replace(/\./g, '_');
    return base || 'folder';
  }

  private static dateStampedDataName(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    return `data [${dd}-${mm}-${yyyy}]`;
  }
}
