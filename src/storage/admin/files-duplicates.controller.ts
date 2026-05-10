import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountRole } from '../../accounts/account-role.enum';
import { Roles } from '../../accounts/roles.decorator';
import { RolesGuard } from '../../accounts/roles.guard';
import { API_V1_PREFIX } from '../../common/api-route';
import {
  DuplicateCleanupResponseDto,
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
@UseGuards(RolesGuard)
@Roles(AccountRole.ADMIN)
export class FilesDuplicatesController {
  constructor(private readonly storage: StorageService) {}

  @Get(AdminFilesSubRoute.DUPLICATES)
  @ApiOperation({
    summary: 'Nhóm file trùng binary Telegram',
    description:
      'Trùng **trong cùng một account**: cùng `telegram_file_unique_id` hoặc `contentSha256` nhưng nhiều bản ghi DB (copy folder, race…). Telegram tái dùng `file_unique_id` giữa user khác nhau trên cùng bot — không gộp xuyên account.',
  })
  @ApiOkResponse({ type: DuplicateFilesResponseDto })
  async duplicates(): Promise<DuplicateFilesResponseDto> {
    const raw = await this.storage.findDuplicateFileGroups();
    const groups: DuplicateFileGroupDto[] = raw.map((g) => ({
      telegramFileUniqueId: g.telegramFileUniqueId,
      contentSha256: g.contentSha256,
      files: g.files.map((f) => FilesDuplicatesController.toSummary(f)),
    }));
    return { groups };
  }

  @Post(AdminFilesSubRoute.DELETE_DUPLICATES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa mềm file trùng binary Telegram',
    description:
      'Giữ bản cũ nhất trong mỗi nhóm trùng **theo từng account** (`telegram_file_unique_id` hoặc SHA256), đưa các bản còn lại vào thùng rác.',
  })
  @ApiOkResponse({ type: DuplicateCleanupResponseDto })
  async deleteDuplicates(): Promise<DuplicateCleanupResponseDto> {
    const result = await this.storage.deleteDuplicateFiles();
    return {
      groups: result.groups,
      deleted: result.deleted,
      files: result.files.map((f) => FilesDuplicatesController.toSummary(f)),
    };
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
      contentSha256: f.contentSha256,
      s3Bucket: f.s3Bucket,
      s3ObjectKey: f.s3ObjectKey,
      thumbnailTelegramFileId: f.thumbnailTelegramFileId,
      telegramMessageId: f.telegramMessageId,
      createdAt: f.createdAt instanceof Date ? f.createdAt : new Date(f.createdAt as string),
    };
  }
}
