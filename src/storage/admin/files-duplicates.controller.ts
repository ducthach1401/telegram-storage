import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_V1_PREFIX } from '../../common/api-route';
import {
  DuplicateFilesResponseDto,
  DuplicateFileGroupDto,
} from '../domain/dto/duplicate-files-response.dto';
import { StoredFile } from '../domain/entities/stored-file.entity';
import { StoredFileSummaryDto } from '../domain/dto/stored-file-summary.dto';
import { StorageService } from '../storage.service';
import {
  AdminControllerPath,
  AdminFilesSubRoute,
} from './admin.routes';

@ApiTags('admin')
@Controller(`${API_V1_PREFIX}/${AdminControllerPath.FILES}`)
export class FilesDuplicatesController {
  constructor(private readonly storage: StorageService) {}

  @Get(AdminFilesSubRoute.DUPLICATES)
  @ApiOperation({
    summary: 'Nhóm file trùng binary Telegram',
    description:
      'Cùng `telegram_file_unique_id` nhưng nhiều bản ghi DB (ví dụ sau copy thư mục).',
  })
  @ApiOkResponse({ type: DuplicateFilesResponseDto })
  async duplicates(): Promise<DuplicateFilesResponseDto> {
    const raw = await this.storage.findDuplicateFileGroups();
    const groups: DuplicateFileGroupDto[] = raw.map((g) => ({
      telegramFileUniqueId: g.telegramFileUniqueId,
      files: g.files.map((f) => FilesDuplicatesController.toSummary(f)),
    }));
    return { groups };
  }

  private static toSummary(f: StoredFile): StoredFileSummaryDto {
    return {
      id: f.id,
      folderId: f.folderId,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      telegramFileId: f.telegramFileId,
      telegramFileUniqueId: f.telegramFileUniqueId,
      thumbnailTelegramFileId: f.thumbnailTelegramFileId,
      telegramMessageId: f.telegramMessageId,
      createdAt: f.createdAt instanceof Date ? f.createdAt : new Date(f.createdAt as string),
    };
  }
}
