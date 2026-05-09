import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { StorageExceptionMessage } from '../common/api-messages';
import {
  MIME_PREFIX_IMAGE,
  ROOT_FOLDER_ALIAS,
  ROOT_FOLDER_ID,
  TYPEORM_ORDER_ASC,
  VIRTUAL_ROOT_FOLDER_NAME,
} from './domain/constants';
import type { DuplicateNamePolicy } from './domain/duplicate-name-policy';
import { CreateFolderDto } from './domain/dto/create-folder.dto';
import { Folder } from './domain/entities/folder.entity';
import { StoredFile } from './domain/entities/stored-file.entity';
import { decodeFileListCursor, encodeFileListCursor } from './domain/file-list-cursor';
import { TelegramService } from './telegram/telegram.service';

export interface ListContentsOpts {
  /** Khi có — phân trang file theo cursor */
  fileLimit?: number;
  fileCursor?: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  constructor(
    @InjectRepository(Folder)
    private readonly folderRepo: Repository<Folder>,
    @InjectRepository(StoredFile)
    private readonly fileRepo: Repository<StoredFile>,
    private readonly telegram: TelegramService,
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
    const folder = await this.folderRepo.findOne({ where: { id } });
    if (!folder) {
      throw new NotFoundException(StorageExceptionMessage.FOLDER_NOT_FOUND);
    }
    return folder;
  }

  async createFolder(dto: CreateFolderDto): Promise<Folder> {
    const parentId = dto.parentId ?? ROOT_FOLDER_ID;
    await this.ensureFolder(parentId);
    const exists = await this.folderRepo.findOne({
      where: { parentId, name: dto.name },
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

  async listContents(
    folderIdParam: string,
    opts?: ListContentsOpts,
  ): Promise<{
    folderId: string;
    folders: Folder[];
    files: StoredFile[];
    filesNextCursor?: string | null;
    filesLimit?: number;
  }> {
    const folderId = this.resolveFolderId(folderIdParam);
    await this.ensureFolder(folderId);
    const folders = await this.folderRepo.find({
      where: { parentId: folderId },
      order: { name: TYPEORM_ORDER_ASC },
    });

    const limit = opts?.fileLimit;
    if (!limit) {
      const files = await this.fileRepo.find({
        where: { folderId },
        order: { name: TYPEORM_ORDER_ASC },
      });
      return { folderId, folders, files };
    }

    const qb = this.fileRepo
      .createQueryBuilder('f')
      .where('f.folderId = :folderId', { folderId })
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
      files,
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

  private async resolveUploadTarget(
    folderIdParam: string | undefined,
    desiredName: string,
    policy: DuplicateNamePolicy,
  ): Promise<{ folderId: string; effectiveName: string }> {
    const folderId = folderIdParam ? this.resolveFolderId(folderIdParam) : ROOT_FOLDER_ID;
    await this.ensureFolder(folderId);

    const dup = await this.fileRepo.findOne({ where: { folderId, name: desiredName } });
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
        where: { folderId, name: candidate },
      });
      if (!exists) {
        return candidate;
      }
    }
    throw new ConflictException(StorageExceptionMessage.FILE_SUFFIX_EXHAUSTED);
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
  ): Promise<StoredFile> {
    await this.ensureFolder(folderId);
    const dup = await this.fileRepo.findOne({ where: { folderId, name: fileName } });
    if (dup) {
      throw new ConflictException(StorageExceptionMessage.FILE_DUPLICATE_NAME);
    }

    const thumb = await this.maybeThumbnail(buffer, mimeType);
    const uploaded = await this.telegram.uploadDocument(buffer, fileName, thumb);

    const entity = this.fileRepo.create({
      folderId,
      name: fileName,
      mimeType,
      size: buffer.length,
      telegramFileId: uploaded.fileId,
      telegramFileUniqueId: uploaded.fileUniqueId,
      thumbnailTelegramFileId: uploaded.thumbnailFileId,
      telegramMessageId: String(uploaded.messageId),
    });
    return this.fileRepo.save(entity);
  }

  async searchFiles(params: {
    q: string;
    folderId?: string;
    mode: 'substring' | 'prefix';
    limit: number;
  }): Promise<StoredFile[]> {
    const limit = Math.min(Math.max(params.limit, 1), 200);
    const escaped = params.q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pat = params.mode === 'prefix' ? `${escaped}%` : `%${escaped}%`;

    const qb = this.fileRepo
      .createQueryBuilder('f')
      .where('f.name LIKE :pat ESCAPE :esc', {
        pat,
        esc: '\\',
      })
      .orderBy('f.name', TYPEORM_ORDER_ASC)
      .addOrderBy('f.id', TYPEORM_ORDER_ASC)
      .take(limit);

    if (params.folderId !== undefined && params.folderId !== '') {
      const fid = this.resolveFolderId(params.folderId);
      await this.ensureFolder(fid);
      qb.andWhere('f.folderId = :fid', { fid });
    }

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
      where: { folderId: targetFolderId, name: targetName },
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

  async deleteFile(id: string): Promise<void> {
    const f = await this.getFile(id);
    await this.removeFileFromDbAndTelegram(f);
  }

  async deleteFolder(folderId: string): Promise<void> {
    if (folderId === ROOT_FOLDER_ID) {
      throw new BadRequestException(
        StorageExceptionMessage.ROOT_FOLDER_DELETE_FORBIDDEN,
      );
    }
    await this.ensureFolder(folderId);

    const children = await this.folderRepo.find({
      where: { parentId: folderId },
      order: { name: TYPEORM_ORDER_ASC },
    });
    for (const child of children) {
      await this.deleteFolder(child.id);
    }

    const files = await this.fileRepo.find({
      where: { folderId },
      order: { name: TYPEORM_ORDER_ASC },
    });
    for (const f of files) {
      await this.removeFileFromDbAndTelegram(f);
    }

    await this.folderRepo.delete({ id: folderId });
  }

  private async removeFileFromDbAndTelegram(f: StoredFile): Promise<void> {
    await this.telegram.deleteChatMessage(f.telegramMessageId);
    await this.fileRepo.remove(f);
  }

  async getFile(id: string): Promise<StoredFile> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(StorageExceptionMessage.FILE_NOT_FOUND);
    }
    return file;
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    return this.telegram.getFileDownloadUrl(fileId);
  }
}
