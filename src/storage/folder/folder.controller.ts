import { InjectQueue } from '@nestjs/bullmq';
import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Queue } from 'bullmq';
import type { Response } from 'express';
import { validate as isUuid } from 'uuid';
import { Public } from '../../auth/public.decorator';
import { ApiExceptionMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import { MimeType } from '../../common/http.constants';
import { ROOT_FOLDER_ALIAS } from '../domain/constants';
import { CopyFolderDto } from '../domain/dto/copy-folder.dto';
import { CreateFolderDto } from '../domain/dto/create-folder.dto';
import { FolderContentsQueryDto } from '../domain/dto/folder-contents-query.dto';
import { FolderContentsResponseDto } from '../domain/dto/folder-contents-response.dto';
import { FolderResponseDto } from '../domain/dto/folder-response.dto';
import { FolderZipJobQueuedDto } from '../domain/dto/folder-zip-job-queued.dto';
import { FolderZipJobStatusDto } from '../domain/dto/folder-zip-job-status.dto';
import {
  FOLDER_ZIP_JOB_NAME,
  FOLDER_ZIP_QUEUE,
} from '../queue/folder-zip.constants';
import type { FolderZipJobResult } from '../queue/folder-zip.processor';
import { BullMqJobState } from '../queue/file-upload.constants';
import { FolderZipDownloadTokenService } from '../share/folder-zip-download-token.service';
import {
  FolderRoutePath,
  FolderZipRouteQuery,
  SharedFilesRoutePath,
} from '../storage-http.constants';
import { StorageService } from '../storage.service';

@ApiTags('folders')
@Controller(`${API_V1_PREFIX}/folders`)
export class FolderController {
  constructor(
    private readonly storage: StorageService,
    private readonly folderZipToken: FolderZipDownloadTokenService,
    @InjectQueue(FOLDER_ZIP_QUEUE)
    private readonly folderZipQueue: Queue<{ folderIdParam: string }>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tạo thư mục trong cha (mặc định gốc)' })
  @ApiCreatedResponse({ type: FolderResponseDto })
  create(@Body(ValidationPipe) dto: CreateFolderDto) {
    return this.storage.createFolder(dto);
  }

  @Post(FolderRoutePath.COPY_FOLDER_PATH)
  @ApiOperation({
    summary: 'Sao chép thư mục (đệ quy, chung Telegram file)',
    description:
      'Tạo bản sao cây thư mục + metadata file trỏ cùng telegram_message/file_id; xóa một bản chỉ gỡ Telegram khi không còn bản ghi nào trỏ tin đó.',
  })
  @ApiParam({ name: FolderRoutePath.PARAM_FOLDER_ID, format: 'uuid' })
  @ApiOkResponse({ type: FolderResponseDto })
  @ApiBadRequestResponse({
    description: 'Đích nằm trong nhánh nguồn hoặc nguồn là root',
  })
  @ApiConflictResponse({ description: 'Trùng tên thư mục con ở đích' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy thư mục' })
  async copyFolder(
    @Param(FolderRoutePath.PARAM_FOLDER_ID, ParseUUIDPipe) sourceFolderId: string,
    @Body(ValidationPipe) body: CopyFolderDto,
  ): Promise<FolderResponseDto> {
    const folder = await this.storage.copyFolderBranch(sourceFolderId, body.parentId);
    return {
      id: folder.id,
      parentId: folder.parentId,
      name: folder.name,
      createdAt:
        folder.createdAt instanceof Date ? folder.createdAt : new Date(folder.createdAt as string),
    };
  }

  @Public()
  @Get(FolderRoutePath.DOWNLOAD_STREAM_PATH)
  @ApiOperation({
    summary: 'Tải file ZIP (job async)',
    description:
      'Query `token` từ GET …/folders/download/jobs/:jobId khi job completed. Không Basic Auth.',
    security: [],
  })
  @ApiBadGatewayResponse({ description: 'Job không có đường dẫn ZIP hợp lệ' })
  @ApiProduces(MimeType.APPLICATION_ZIP)
  @ApiQuery({ name: FolderZipRouteQuery.TOKEN, required: true })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ / hết hạn' })
  @ApiBadRequestResponse({ description: 'Job chưa xong hoặc thiếu token' })
  @ApiNotFoundResponse({ description: 'Không có job' })
  async streamFolderZipByToken(
    @Query(FolderZipRouteQuery.TOKEN) token: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!token?.trim()) {
      throw new BadRequestException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    const jobId = this.folderZipToken.verifyJobId(token.trim());
    const job = await this.folderZipQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(ApiExceptionMessage.JOB_NOT_FOUND);
    }
    const state = await job.getState();
    if (state !== BullMqJobState.COMPLETED) {
      throw new BadRequestException(ApiExceptionMessage.FOLDER_ZIP_JOB_NOT_READY);
    }
    const rv = job.returnvalue as FolderZipJobResult | undefined;
    if (!rv?.zipPath || !rv.zipBaseName) {
      throw new BadGatewayException(ApiExceptionMessage.FOLDER_ZIP_JOB_NOT_READY);
    }
    await this.storage.streamZipFileToResponse(rv.zipPath, rv.zipBaseName, res);
  }

  @Get(FolderRoutePath.DOWNLOAD_JOB_STATUS_PATH)
  @ApiOperation({
    summary: 'Trạng thái job ZIP thư mục',
    description:
      'Khi completed có `zipDownloadToken` và path stream (kèm token). Token TTL: `FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS`.',
  })
  @ApiParam({ name: 'jobId', description: 'Từ POST …/folders/:folderId/download/async' })
  @ApiOkResponse({ type: FolderZipJobStatusDto })
  @ApiNotFoundResponse({ description: 'Không có job' })
  async folderZipJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<FolderZipJobStatusDto> {
    const job = await this.folderZipQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(ApiExceptionMessage.JOB_NOT_FOUND);
    }
    const state = await job.getState();
    const dto: FolderZipJobStatusDto = {
      jobId: String(job.id),
      state,
    };
    if (state === BullMqJobState.FAILED) {
      dto.failedReason = job.failedReason ?? undefined;
    }
    if (state === BullMqJobState.COMPLETED && job.id !== undefined) {
      const { token, expiresAt } = this.folderZipToken.create(String(job.id));
      dto.zipDownloadToken = token;
      dto.zipDownloadExpiresAt = expiresAt;
      dto.downloadStreamPath = `/${API_V1_PREFIX}/folders/${FolderRoutePath.DOWNLOAD_STREAM_PATH}?${FolderZipRouteQuery.TOKEN}=${encodeURIComponent(token)}`;
    }
    return dto;
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

  @Post(FolderRoutePath.DOWNLOAD_ZIP_ASYNC_PATH)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Tạo ZIP thư mục qua queue',
    description:
      'Trả jobId — tra GET …/folders/download/jobs/:jobId rồi tải qua GET …/folders/download/stream?token=…',
  })
  @ApiParam({
    name: FolderRoutePath.PARAM_FOLDER_ID,
    description: '`root` hoặc UUID',
    examples: {
      root: { value: ROOT_FOLDER_ALIAS },
      uuid: { value: '550e8400-e29b-41d4-a716-446655440000' },
    },
  })
  @ApiAcceptedResponse({ type: FolderZipJobQueuedDto })
  @ApiBadRequestResponse({ description: 'folderId không hợp lệ' })
  async enqueueFolderZip(
    @Param(FolderRoutePath.PARAM_FOLDER_ID) folderId: string,
  ): Promise<FolderZipJobQueuedDto> {
    if (folderId !== ROOT_FOLDER_ALIAS && !isUuid(folderId)) {
      throw new BadRequestException(ApiExceptionMessage.FOLDER_ID_INVALID);
    }
    const job = await this.folderZipQueue.add(FOLDER_ZIP_JOB_NAME, {
      folderIdParam: folderId,
    });
    if (job.id === undefined) {
      throw new BadGatewayException(ApiExceptionMessage.QUEUE_JOB_CREATE_FAILED);
    }
    return { jobId: String(job.id) };
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
    description:
      'Xóa đệ quy mọi thư mục con và file; không cho xóa thư mục gốc UUID cố định.',
  })
  @ApiParam({ name: FolderRoutePath.PARAM_FOLDER_ID, format: 'uuid' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Thư mục gốc không được xóa' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy thư mục' })
  async remove(@Param(FolderRoutePath.PARAM_FOLDER_ID, ParseUUIDPipe) folderId: string) {
    await this.storage.deleteFolder(folderId);
  }
}
