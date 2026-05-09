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
  ApiTags,
} from '@nestjs/swagger';
import { validate as isUuid } from 'uuid';
import { API_V1_PREFIX } from '../../common/api-route';
import { CreateFolderDto } from '../domain/dto/create-folder.dto';
import { FolderContentsResponseDto } from '../domain/dto/folder-contents-response.dto';
import { FolderResponseDto } from '../domain/dto/folder-response.dto';
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
  @Get(':folderId/contents')
  @ApiOperation({ summary: 'Liệt kê thư mục con và file trong thư mục' })
  @ApiParam({
    name: 'folderId',
    description: '`root` hoặc UUID thư mục',
    examples: {
      root: { value: 'root', summary: 'Thư mục gốc' },
      uuid: {
        value: '550e8400-e29b-41d4-a716-446655440000',
        summary: 'UUID thư mục',
      },
    },
  })
  @ApiOkResponse({ type: FolderContentsResponseDto })
  @ApiBadRequestResponse({ description: 'folderId không phải root hoặc UUID' })
  listContents(@Param('folderId') folderId: string) {
    if (folderId !== 'root' && !isUuid(folderId)) {
      throw new BadRequestException('folderId phải là "root" hoặc UUID hợp lệ');
    }
    return this.storage.listContents(folderId);
  }

  @Delete(':folderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa thư mục',
    description: 'Xóa đệ quy mọi thư mục con và file; không cho xóa thư mục gốc UUID cố định.',
  })
  @ApiParam({ name: 'folderId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Thư mục gốc không được xóa' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy thư mục' })
  async remove(@Param('folderId', ParseUUIDPipe) folderId: string) {
    await this.storage.deleteFolder(folderId);
  }
}
