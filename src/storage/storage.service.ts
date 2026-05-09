import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { ROOT_FOLDER_ID } from './constants';
import { CreateFolderDto } from './dto/create-folder.dto';
import { Folder } from './entities/folder.entity';
import { StoredFile } from './entities/stored-file.entity';
import { TelegramService } from './telegram.service';

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
          name: 'Root',
        }),
      );
    }
  }

  resolveFolderId(folderParam: string): string {
    return folderParam === 'root' ? ROOT_FOLDER_ID : folderParam;
  }

  async ensureFolder(id: string): Promise<Folder> {
    const folder = await this.folderRepo.findOne({ where: { id } });
    if (!folder) {
      throw new NotFoundException('Không tìm thấy thư mục');
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
      throw new ConflictException('Đã có thư mục cùng tên trong thư mục cha');
    }
    const folder = this.folderRepo.create({
      parentId,
      name: dto.name,
    });
    return this.folderRepo.save(folder);
  }

  async listContents(folderIdParam: string): Promise<{
    folderId: string;
    folders: Folder[];
    files: StoredFile[];
  }> {
    const folderId = this.resolveFolderId(folderIdParam);
    await this.ensureFolder(folderId);
    const folders = await this.folderRepo.find({
      where: { parentId: folderId },
      order: { name: 'ASC' },
    });
    const files = await this.fileRepo.find({
      where: { folderId },
      order: { name: 'ASC' },
    });
    return { folderId, folders, files };
  }

  private async maybeThumbnail(buffer: Buffer, mime: string): Promise<Buffer | undefined> {
    if (!mime.startsWith('image/')) {
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
    originalName: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<StoredFile> {
    const folderId = folderIdParam ? this.resolveFolderId(folderIdParam) : ROOT_FOLDER_ID;
    await this.ensureFolder(folderId);

    const dup = await this.fileRepo.findOne({ where: { folderId, name: originalName } });
    if (dup) {
      throw new ConflictException('Đã có file cùng tên trong thư mục');
    }

    const thumb = await this.maybeThumbnail(buffer, mimeType);
    const uploaded = await this.telegram.uploadDocument(buffer, originalName, thumb);

    const entity = this.fileRepo.create({
      folderId,
      name: originalName,
      mimeType,
      size: buffer.length,
      telegramFileId: uploaded.fileId,
      telegramFileUniqueId: uploaded.fileUniqueId,
      thumbnailTelegramFileId: uploaded.thumbnailFileId,
    });
    return this.fileRepo.save(entity);
  }

  async getFile(id: string): Promise<StoredFile> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException('Không tìm thấy file');
    }
    return file;
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    return this.telegram.getFileDownloadUrl(fileId);
  }
}
