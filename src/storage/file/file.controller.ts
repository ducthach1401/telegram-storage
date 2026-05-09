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
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBadGatewayResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { validate as isUuid } from 'uuid';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { Readable } from 'stream';
import { ApiExceptionMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import { ROOT_FOLDER_ALIAS, ROOT_FOLDER_ID } from '../domain/constants';
import { parseDuplicateNamePolicy } from '../domain/duplicate-name-policy';
import { DuplicatePolicyQueryDto } from '../domain/dto/duplicate-policy-query.dto';
import { FileSearchQueryDto } from '../domain/dto/file-search-query.dto';
import { FileSearchResponseDto } from '../domain/dto/file-search-response.dto';
import { PatchFileDto } from '../domain/dto/patch-file.dto';
import { EnvKey } from '../../common/env-keys';
import {
  CacheControlValue,
  ContentDispositionMode,
  HttpHeader,
  MimeType,
} from '../../common/http.constants';
import { UploadDefaults } from '../../common/upload.defaults';
import { FileMetaResponseDto } from '../domain/dto/file-meta-response.dto';
import { StoredFileSummaryDto } from '../domain/dto/stored-file-summary.dto';
import { UploadJobQueuedDto } from '../domain/dto/upload-job-queued.dto';
import { UploadJobStatusDto } from '../domain/dto/upload-job-status.dto';
import { StoredFile } from '../domain/entities/stored-file.entity';
import { asyncUploadDiskStorage } from '../multer-async-disk.storage';
import {
  BullMqJobState,
  FILE_UPLOAD_JOB_NAME,
  FILE_UPLOAD_QUEUE,
} from '../queue/file-upload.constants';
import type { FileUploadJobData } from '../queue/file-upload.processor';
import { StorageService } from '../storage.service';
import {
  FileMultipart,
  FileRouteParam,
  FileRoutePath,
} from '../storage-http.constants';

function contentDisposition(
  mode: (typeof ContentDispositionMode)[keyof typeof ContentDispositionMode],
  name: string,
): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_');
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

@ApiTags('files')
@Controller(`${API_V1_PREFIX}/files`)
export class FileController {
  constructor(
    private readonly storage: StorageService,
    @InjectQueue(FILE_UPLOAD_QUEUE) private readonly uploadQueue: Queue<FileUploadJobData>,
  ) {}

  @Post(FileRoutePath.UPLOAD)
  @ApiOperation({ summary: 'Upload file (multipart)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [FileMultipart.FIELD_FILE],
      properties: {
        [FileMultipart.FIELD_FILE]: {
          type: 'string',
          format: 'binary',
          description: 'Nội dung file',
        },
        [FileMultipart.BODY_FOLDER_ID]: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'Thư mục đích; bỏ trống = gốc',
        },
      },
    },
  })
  @ApiOkResponse({
    type: StoredFileSummaryDto,
    description: 'Metadata file sau khi lưu + đẩy Telegram',
  })
  @ApiConflictResponse({ description: 'Trùng tên khi duplicatePolicy=reject' })
  @ApiQuery({ name: 'duplicatePolicy', required: false, enum: ['reject', 'overwrite', 'suffix'] })
  @ApiQuery({ name: 'overwrite', required: false, description: 'true = như duplicatePolicy=overwrite' })
  @UseInterceptors(FileInterceptor(FileMultipart.FIELD_FILE))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() dup: DuplicatePolicyQueryDto,
    @Body(FileMultipart.BODY_FOLDER_ID) folderId?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(ApiExceptionMessage.MISSING_MULTIPART_FILE);
    }
    const policy = parseDuplicateNamePolicy(dup.duplicatePolicy, dup.overwrite);
    return this.storage.saveUploadedFile(
      folderId,
      file.originalname,
      file.mimetype,
      file.buffer,
      policy,
    );
  }

  @Post(FileRoutePath.UPLOAD_ASYNC)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Upload file qua queue Redis (bulk / không chặn Telegram)',
    description:
      'Lưu file tạm trên đĩa, trả jobId; worker upload Telegram + DB sau. Tra cứu GET …/upload/jobs/:jobId.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [FileMultipart.FIELD_FILE],
      properties: {
        [FileMultipart.FIELD_FILE]: { type: 'string', format: 'binary' },
        [FileMultipart.BODY_FOLDER_ID]: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'Thư mục đích; bỏ trống = gốc',
        },
      },
    },
  })
  @ApiAcceptedResponse({
    type: UploadJobQueuedDto,
    description: 'Đã nhận file — xử lý nền',
  })
  @ApiQuery({ name: 'duplicatePolicy', required: false, enum: ['reject', 'overwrite', 'suffix'] })
  @ApiQuery({ name: 'overwrite', required: false })
  @UseInterceptors(
    FileInterceptor(FileMultipart.FIELD_FILE, {
      storage: asyncUploadDiskStorage,
      limits: {
        fileSize:
          Number(
            process.env[EnvKey.MAX_UPLOAD_MB] ??
              String(UploadDefaults.MAX_UPLOAD_MB_FALLBACK),
          ) *
          1024 *
          1024,
      },
    }),
  )
  async uploadAsync(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() dup: DuplicatePolicyQueryDto,
    @Body(FileMultipart.BODY_FOLDER_ID) folderId?: string,
  ): Promise<UploadJobQueuedDto> {
    if (!file?.path) {
      throw new BadRequestException(ApiExceptionMessage.MISSING_MULTIPART_FILE);
    }
    const policy = parseDuplicateNamePolicy(dup.duplicatePolicy, dup.overwrite);
    const { finalFileName } = await this.storage.prepareAsyncUpload(
      folderId,
      file.originalname,
      policy,
    );

    const job = await this.uploadQueue.add(FILE_UPLOAD_JOB_NAME, {
      tempPath: file.path,
      folderId,
      finalFileName,
      mimeType: file.mimetype,
    });

    if (job.id === undefined) {
      throw new BadGatewayException(ApiExceptionMessage.QUEUE_JOB_CREATE_FAILED);
    }

    return { jobId: String(job.id) };
  }

  @Get(FileRoutePath.UPLOAD_JOB_STATUS)
  @ApiOperation({ summary: 'Trạng thái job upload async' })
  @ApiParam({
    name: FileRouteParam.JOB_ID,
    description: 'Giá trị jobId từ POST upload/async',
  })
  @ApiOkResponse({ type: UploadJobStatusDto })
  @ApiNotFoundResponse({ description: 'Không có job' })
  async uploadJobStatus(
    @Param(FileRouteParam.JOB_ID) jobId: string,
  ): Promise<UploadJobStatusDto> {
    const job = await this.uploadQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(ApiExceptionMessage.JOB_NOT_FOUND);
    }

    const state = await job.getState();
    const dto: UploadJobStatusDto = {
      jobId: String(job.id),
      state,
    };

    if (state === BullMqJobState.COMPLETED && job.returnvalue != null) {
      dto.result = FileController.toSummary(job.returnvalue as StoredFile);
    }
    if (state === BullMqJobState.FAILED) {
      dto.failedReason = job.failedReason ?? undefined;
    }

    return dto;
  }

  @Get(FileRoutePath.SEARCH)
  @ApiOperation({
    summary: 'Tìm file theo tên',
    description:
      'substring hoặc prefix; có thể lọc `folderId` (UUID hoặc root). Giới hạn `limit` (mặc định 50).',
  })
  @ApiOkResponse({ type: FileSearchResponseDto })
  async search(@Query() query: FileSearchQueryDto): Promise<FileSearchResponseDto> {
    const items = await this.storage.searchFiles({
      q: query.q,
      folderId: query.folderId,
      mode: query.mode ?? 'substring',
      limit: query.limit ?? 50,
    });
    return {
      items: items.map((f) => FileController.toSummary(f)),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Đổi tên / di chuyển file',
    description:
      'Chỉ cập nhật DB (Telegram file_id giữ nguyên). Query duplicatePolicy | overwrite giống upload.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StoredFileSummaryDto })
  @ApiConflictResponse({ description: 'Trùng tên ở thư mục đích khi duplicatePolicy=reject' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy file' })
  @ApiQuery({ name: 'duplicatePolicy', required: false, enum: ['reject', 'overwrite', 'suffix'] })
  @ApiQuery({ name: 'overwrite', required: false })
  async patchFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) body: PatchFileDto,
    @Query() dup: DuplicatePolicyQueryDto,
  ): Promise<StoredFileSummaryDto> {
    if (body.name === undefined && body.folderId === undefined) {
      throw new BadRequestException(ApiExceptionMessage.PATCH_FILE_NO_CHANGE);
    }
    let resolvedFolder: string | undefined;
    if (body.folderId !== undefined) {
      if (body.folderId === ROOT_FOLDER_ALIAS) {
        resolvedFolder = ROOT_FOLDER_ID;
      } else if (!isUuid(body.folderId)) {
        throw new BadRequestException(ApiExceptionMessage.INVALID_PATCH_FOLDER_ID);
      } else {
        resolvedFolder = body.folderId;
      }
    }
    const policy = parseDuplicateNamePolicy(dup.duplicatePolicy, dup.overwrite);
    const saved = await this.storage.patchFile(
      id,
      { name: body.name, folderId: resolvedFolder },
      policy,
    );
    return FileController.toSummary(saved);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa file',
    description:
      'Xóa metadata và cố gắng xóa tin nhắn Telegram (cần message_id từ lần upload mới).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Không tìm thấy file' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.storage.deleteFile(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Metadata file (JSON)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FileMetaResponseDto })
  async meta(@Param('id', ParseUUIDPipe) id: string) {
    const f = await this.storage.getFile(id);
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      folderId: f.folderId,
      createdAt: f.createdAt,
      hasThumbnail: !!f.thumbnailTelegramFileId,
    };
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Tải file (Content-Disposition: attachment)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('application/octet-stream')
  @ApiBadGatewayResponse({ description: 'Không tải được từ Telegram' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.pipeOriginal(id, res, ContentDispositionMode.ATTACHMENT);
  }

  /** Hiển thị trong trình duyệt (ảnh/PDF tùy MIME) */
  @Get(':id/view')
  @ApiOperation({ summary: 'Xem file inline (Content-Disposition: inline)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('application/octet-stream', 'image/*', 'application/pdf')
  @ApiBadGatewayResponse({ description: 'Không tải được từ Telegram' })
  async view(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.pipeOriginal(id, res, ContentDispositionMode.INLINE);
  }

  @Get(':id/thumbnail')
  @ApiOperation({ summary: 'Thumbnail JPEG (nếu có)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('image/jpeg')
  @ApiNotFoundResponse({ description: 'File không có thumbnail' })
  @ApiBadGatewayResponse({ description: 'Không tải được từ Telegram' })
  async thumbnail(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const f = await this.storage.getFile(id);
    const thumbId = f.thumbnailTelegramFileId;
    if (!thumbId) {
      throw new NotFoundException(ApiExceptionMessage.FILE_NO_THUMBNAIL);
    }
    const url = await this.storage.getDownloadUrl(thumbId);
    const r = await fetch(url);
    if (!r.ok || !r.body) {
      throw new BadGatewayException(
        ApiExceptionMessage.TELEGRAM_THUMB_DOWNLOAD_FAILED,
      );
    }
    res.setHeader(HttpHeader.CONTENT_TYPE, MimeType.JPEG);
    res.setHeader(HttpHeader.CACHE_CONTROL, CacheControlValue.PUBLIC_DAY);
    Readable.fromWeb(r.body as import('stream/web').ReadableStream).pipe(res);
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

  private async pipeOriginal(
    id: string,
    res: Response,
    disposition: (typeof ContentDispositionMode)[keyof typeof ContentDispositionMode],
  ) {
    const f = await this.storage.getFile(id);
    const url = await this.storage.getDownloadUrl(f.telegramFileId);
    const r = await fetch(url);
    if (!r.ok || !r.body) {
      throw new BadGatewayException(
        ApiExceptionMessage.TELEGRAM_FILE_DOWNLOAD_FAILED,
      );
    }
    res.setHeader(HttpHeader.CONTENT_TYPE, f.mimeType);
    res.setHeader(
      HttpHeader.CONTENT_DISPOSITION,
      contentDisposition(disposition, f.name),
    );
    Readable.fromWeb(r.body as import('stream/web').ReadableStream).pipe(res);
  }
}
