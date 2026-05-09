import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { validate as isUuid } from 'uuid';
import { ApiExceptionMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import { MimeType } from '../../common/http.constants';
import { ROOT_FOLDER_ALIAS } from '../domain/constants';
import { CreateFolderDto } from '../domain/dto/create-folder.dto';
import { FolderContentsQueryDto } from '../domain/dto/folder-contents-query.dto';
import { FolderContentsResponseDto } from '../domain/dto/folder-contents-response.dto';
import { FolderResponseDto } from '../domain/dto/folder-response.dto';
import { FolderRoutePath } from '../storage-http.constants';
import { StorageService } from '../storage.service';

@ApiTags('folders')
@Controller(`${API_V1_PREFIX}/folders`)
export class FolderController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo thư mục trong cha (mặc định gốc)' })
  @ApiCreatedResponse({ type: FolderResponseDto })
  create(@Body(ValidationPipe) dto: CreateFolderDto) {
    return this.storage.createFolder(dto);
  }

  /** `folderId` = `root` hoặc UUID — ZIP gồm mọi file trong thư mục và cây con */
  @Get(FolderRoutePath.DOWNLOAD_ZIP_PATH)
  @ApiOperation({
    summary: 'Tải cả thư mục (ZIP đệ quy)',
    description:
      'Stream file ZIP: mọi file trong thư mục và thư mục con (đường dẫn trong ZIP giữ cấu trúc thư mục). Tải tuần tự từ Telegram nên có thể chậm. Giới hạn số file: biến env `FOLDER_ZIP_MAX_FILES` (mặc định 2000 trong code nếu không set; tối đa 50000).',
  })
  @ApiParam({
    name: FolderRoutePath.PARAM_FOLDER_ID,
    description: '`root` hoặc UUID thư mục',
    examples: {
      root: { value: ROOT_FOLDER_ALIAS, summary: 'Toàn bộ drive (gốc)' },
      uuid: {
        value: '550e8400-e29b-41d4-a716-446655440000',
        summary: 'UUID thư mục',
      },
    },
  })
  @ApiProduces(MimeType.APPLICATION_ZIP)
  @ApiBadRequestResponse({
    description: 'folderId không hợp lệ hoặc quá nhiều file (FOLDER_ZIP_MAX_FILES)',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy thư mục' })
  @ApiBadGatewayResponse({ description: 'Không tải được ít nhất một file từ Telegram' })
  async downloadFolderZip(
    @Param(FolderRoutePath.PARAM_FOLDER_ID) folderId: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (folderId !== ROOT_FOLDER_ALIAS && !isUuid(folderId)) {
      throw new BadRequestException(ApiExceptionMessage.FOLDER_ID_INVALID);
    }
    await this.storage.streamFolderZipToResponse(folderId, res);
  }

  /** `folderId` = `root` hoặc UUID */
  @Get(FolderRoutePath.CONTENTS_PATH)
  @ApiOperation({ summary: 'Liệt kê thư mục con và file trong thư mục' })
  @ApiParam({
    name: FolderRoutePath.PARAM_FOLDER_ID,
    description: '`root` hoặc UUID thư mục',
    examples: {
      root: { value: ROOT_FOLDER_ALIAS, summary: 'Thư mục gốc' },
      uuid: {
        value: '550e8400-e29b-41d4-a716-446655440000',
        summary: 'UUID thư mục',
      },
    },
  })
  @ApiQuery({
    name: 'fileLimit',
    required: false,
    description:
      'Giới hạn số file (phân trang). Không gửi = trả toàn bộ file như trước.',
    schema: { type: 'integer', minimum: 1, maximum: 500 },
  })
  @ApiQuery({
    name: 'fileCursor',
    required: false,
    description: 'Cursor trang tiếp (từ filesNextCursor); bắt buộc có fileLimit.',
  })
  @ApiQuery({
    name: 'folderLimit',
    required: false,
    description:
      'Giới hạn số thư mục con (phân trang). Không gửi = trả toàn bộ thư mục con.',
    schema: { type: 'integer', minimum: 1, maximum: 500 },
  })
  @ApiQuery({
    name: 'folderCursor',
    required: false,
    description:
      'Cursor trang tiếp (từ foldersNextCursor); bắt buộc có folderLimit.',
  })
  @ApiOkResponse({ type: FolderContentsResponseDto })
  @ApiBadRequestResponse({ description: 'folderId không phải root hoặc UUID' })
  listContents(
    @Param(FolderRoutePath.PARAM_FOLDER_ID) folderId: string,
    @Query() query: FolderContentsQueryDto,
  ) {
    if (folderId !== ROOT_FOLDER_ALIAS && !isUuid(folderId)) {
      throw new BadRequestException(ApiExceptionMessage.FOLDER_ID_INVALID);
    }
    if (query.fileCursor && query.fileLimit === undefined) {
      throw new BadRequestException(ApiExceptionMessage.FILE_CURSOR_REQUIRES_LIMIT);
    }
    if (query.folderCursor && query.folderLimit === undefined) {
      throw new BadRequestException(ApiExceptionMessage.FOLDER_CURSOR_REQUIRES_LIMIT);
    }
    return this.storage.listContents(folderId, {
      fileLimit: query.fileLimit,
      fileCursor: query.fileCursor,
      folderLimit: query.folderLimit,
      folderCursor: query.folderCursor,
    });
  }

  @Delete(FolderRoutePath.SINGLE_FOLDER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa thư mục',
    description: 'Xóa đệ quy mọi thư mục con và file; không cho xóa thư mục gốc UUID cố định.',
  })
  @ApiParam({ name: FolderRoutePath.PARAM_FOLDER_ID, format: 'uuid' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Thư mục gốc không được xóa' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy thư mục' })
  async remove(@Param(FolderRoutePath.PARAM_FOLDER_ID, ParseUUIDPipe) folderId: string) {
    await this.storage.deleteFolder(folderId);
  }
}
