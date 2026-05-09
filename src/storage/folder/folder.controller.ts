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
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { validate as isUuid } from 'uuid';
import { ApiExceptionMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
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
    return this.storage.listContents(folderId, {
      fileLimit: query.fileLimit,
      fileCursor: query.fileCursor,
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
