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
import { unlink } from 'fs/promises';
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
import type { Account } from '../../accounts/account.entity';
import { CurrentAccount } from '../../accounts/current-account.decorator';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { ApiExceptionMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import { ROOT_FOLDER_ALIAS } from '../domain/constants';
import { parseDuplicateNamePolicy } from '../domain/duplicate-name-policy';
import { CreateShareDownloadDto } from '../domain/dto/create-share-download.dto';
import { DuplicatePolicyQueryDto } from '../domain/dto/duplicate-policy-query.dto';
import { FileSearchQueryDto } from '../domain/dto/file-search-query.dto';
import { FileSearchResponseDto } from '../domain/dto/file-search-response.dto';
import { PatchFileDto } from '../domain/dto/patch-file.dto';
import { ShareDownloadLinkResponseDto } from '../domain/dto/share-download-link-response.dto';
import { EnvKey } from '../../common/env-keys';
import {
  ContentDispositionMode,
  HttpHeader,
} from '../../common/http.constants';
import { RuntimeConfigService } from '../../settings/runtime-config.service';
import {
  FileMetaBatchRequestDto,
  FileMetaBatchResponseDto,
} from '../domain/dto/file-meta-batch.dto';
import { FileMetaResponseDto } from '../domain/dto/file-meta-response.dto';
import { FileTagsResponseDto, UpdateFileTagsDto } from '../domain/dto/file-tags.dto';
import { FolderContentsResponseDto } from '../domain/dto/folder-contents-response.dto';
import { FolderResponseDto } from '../domain/dto/folder-response.dto';
import { StoredFileSummaryDto } from '../domain/dto/stored-file-summary.dto';
import { StorageQuotaResponseDto } from '../domain/dto/storage-quota-response.dto';
import { TrashedFileDto, TrashedFolderDto, TrashListResponseDto } from '../domain/dto/trash-response.dto';
import { UploadJobQueuedDto } from '../domain/dto/upload-job-queued.dto';
import { UploadJobStatusDto } from '../domain/dto/upload-job-status.dto';
import { Folder } from '../domain/entities/folder.entity';
import { StoredFile } from '../domain/entities/stored-file.entity';
import { repairUtf8FilenameMojibake } from '../../common/multipart-filename';
import { accountLimitedFileInterceptor } from '../interceptors/account-limited-file.interceptor';
import {
  BullMqJobState,
  FILE_UPLOAD_JOB_NAME,
  FILE_UPLOAD_QUEUE,
} from '../queue/file-upload.constants';
import type { FileUploadJobData } from '../queue/file-upload.processor';
import { ShareDownloadTokenService } from '../share/share-download-token.service';
import { StorageService } from '../storage.service';
import {
  FileMultipart,
  FileRouteParam,
  FileRoutePath,
  FileRoutePathSegment,
  SharedFilesQuery,
  SharedFilesRoutePath,
} from '../storage-http.constants';
import { telegramPublicMessageUrl } from '../telegram.constants';

@ApiTags('files')
@Controller(`${API_V1_PREFIX}/files`)
export class FileController {
  constructor(
    private readonly storage: StorageService,
    private readonly runtime: RuntimeConfigService,
    private readonly shareDownloadToken: ShareDownloadTokenService,
    @InjectQueue(FILE_UPLOAD_QUEUE) private readonly uploadQueue: Queue<FileUploadJobData>,
  ) {}

  private tenant(acc: Account) {
    return this.storage.storageTenantFromAccountEntity(acc);
  }

  @Get(FileRoutePath.QUOTA)
  @ApiOperation({
    summary: 'Quota / thống kê dung lượng',
    description: 'Thống kê file active, file trong thùng rác và dung lượng theo MIME type.',
  })
  @ApiOkResponse({ type: StorageQuotaResponseDto })
  async quota(@CurrentAccount() account: Account): Promise<StorageQuotaResponseDto> {
    return this.storage.getStorageQuotaStats(this.tenant(account));
  }

  @Get(FileRoutePath.TRASH)
  @ApiOperation({ summary: 'Danh sách file và folder trong thùng rác' })
  @ApiQuery({ name: 'limit', required: false, schema: { minimum: 1, maximum: 200 } })
  @ApiOkResponse({ type: TrashListResponseDto })
  async trash(
    @CurrentAccount() account: Account,
    @Query('limit') limit?: string,
  ): Promise<TrashListResponseDto> {
    const trashLimit = limit ? Number(limit) : 100;
    const t = this.tenant(account);
    const [folders, items] = await Promise.all([
      this.storage.listTrashedFolders(t, trashLimit),
      this.storage.listTrashedFiles(t, trashLimit),
    ]);
    return {
      folders: folders.map((f) => FileController.toTrashedFolder(f)),
      items: items.map((f) =>
        FileController.toTrashedFile(f, this.runtime.telegramDownloadMaxBytes(), t.telegramStorageChatId),
      ),
    };
  }

  @Get(`${FileRoutePath.TRASH}/folders/:id/contents`)
  @ApiOperation({ summary: 'Danh sách nội dung folder trong thùng rác' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FolderContentsResponseDto })
  @ApiNotFoundResponse({ description: 'Không tìm thấy folder trong thùng rác' })
  async trashFolderContents(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FolderContentsResponseDto> {
    const t = this.tenant(account);
    const contents = await this.storage.listTrashFolderContents(t, id);
    return {
      folderId: contents.folderId,
      folders: contents.folders.map((folder) => FileController.toFolderForTrashView(folder)),
      files: contents.files.map((file) =>
        FileController.toSummary(file, this.runtime.telegramDownloadMaxBytes(), t.telegramStorageChatId),
      ),
    };
  }

  @Delete(FileRoutePath.TRASH)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa sạch thùng rác' })
  @ApiNoContentResponse()
  async emptyTrash(@CurrentAccount() account: Account) {
    await this.storage.emptyTrash(this.tenant(account));
  }

  @Post(`${FileRoutePath.TRASH}/folders/:id/restore`)
  @ApiOperation({ summary: 'Khôi phục folder từ thùng rác' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TrashedFolderDto })
  async restoreFolderFromTrash(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrashedFolderDto> {
    const restored = await this.storage.restoreFolder(this.tenant(account), id);
    return FileController.toTrashedFolder(restored);
  }

  @Delete(`${FileRoutePath.TRASH}/folders/:id`)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa vĩnh viễn folder trong thùng rác' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  async permanentlyRemoveFolderFromTrash(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.storage.permanentlyDeleteFolder(this.tenant(account), id);
  }

  @Post(`${FileRoutePath.TRASH}/:id/restore`)
  @ApiOperation({
    summary: 'Khôi phục file từ thùng rác',
    description: 'Mặc định tự thêm hậu tố nếu tên cũ đang bị trùng; hỗ trợ duplicatePolicy/overwrite.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'duplicatePolicy', required: false, enum: ['reject', 'overwrite', 'suffix'] })
  @ApiQuery({ name: 'overwrite', required: false })
  @ApiQuery({ name: 'allowDuplicateContent', required: false })
  @ApiOkResponse({ type: StoredFileSummaryDto })
  @ApiNotFoundResponse({ description: 'Không tìm thấy file trong thùng rác' })
  async restoreFromTrash(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dup: DuplicatePolicyQueryDto,
  ): Promise<StoredFileSummaryDto> {
    const policy = parseDuplicateNamePolicy(dup.duplicatePolicy ?? 'suffix', dup.overwrite);
    const t = this.tenant(account);
    const restored = await this.storage.restoreFile(t, id, policy);
    return FileController.toSummary(restored, this.runtime.telegramDownloadMaxBytes(), t.telegramStorageChatId);
  }

  @Delete(`${FileRoutePath.TRASH}/:id`)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa vĩnh viễn file trong thùng rác' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Không tìm thấy file trong thùng rác' })
  async permanentlyRemoveFromTrash(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.storage.permanentlyDeleteFile(this.tenant(account), id);
  }

  @Get(`${FileRoutePath.TRASH}/:id/download`)
  @ApiOperation({ summary: 'Tải file trong thùng rác (Content-Disposition: attachment)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('application/octet-stream')
  @ApiBadGatewayResponse({ description: 'Không tải được từ Telegram' })
  async downloadFromTrash(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.storage.streamOriginalToExpressResponse(
      id,
      res,
      ContentDispositionMode.ATTACHMENT,
      { includeTrashed: true },
    );
  }

  @Get(`${FileRoutePath.TRASH}/:id/view`)
  @ApiOperation({ summary: 'Xem file trong thùng rác inline (Content-Disposition: inline)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('application/octet-stream', 'image/*', 'application/pdf')
  @ApiBadGatewayResponse({ description: 'Không tải được từ Telegram' })
  async viewFromTrash(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.storage.streamOriginalToExpressResponse(
      id,
      res,
      ContentDispositionMode.INLINE,
      { includeTrashed: true },
    );
  }

  @Get(`${FileRoutePath.TRASH}/:id/thumbnail`)
  @ApiOperation({ summary: 'Thumbnail JPEG cho file trong thùng rác (nếu có)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('image/jpeg')
  @ApiNotFoundResponse({ description: 'File không có thumbnail' })
  @ApiBadGatewayResponse({ description: 'Không tải được từ Telegram' })
  async thumbnailFromTrash(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.storage.streamThumbnailToExpressResponse(
      this.tenant(account),
      id,
      res,
      { includeTrashed: true },
    );
  }

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
  @UseInterceptors(accountLimitedFileInterceptor(FileMultipart.FIELD_FILE))
  async upload(
    @CurrentAccount() account: Account,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() dup: DuplicatePolicyQueryDto,
    @Body(FileMultipart.BODY_FOLDER_ID) folderId?: string,
  ) {
    if (!file?.path) {
      throw new BadRequestException(ApiExceptionMessage.MISSING_MULTIPART_FILE);
    }
    const policy = parseDuplicateNamePolicy(dup.duplicatePolicy, dup.overwrite);
    const t = this.tenant(account);
    try {
      const { folderId: targetFolderId, effectiveName } = await this.storage.resolveUploadTarget(
        t,
        folderId,
        file.originalname,
        policy,
      );
      return await this.storage.persistUploadedDocumentFromPath(
        t,
        targetFolderId,
        effectiveName,
        file.mimetype,
        file.path,
        file.size,
      );
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
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
  @UseInterceptors(accountLimitedFileInterceptor(FileMultipart.FIELD_FILE))
  async uploadAsync(
    @CurrentAccount() account: Account,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() dup: DuplicatePolicyQueryDto,
    @Query('allowDuplicateContent') allowDuplicateContent?: string,
    @Body(FileMultipart.BODY_FOLDER_ID) folderId?: string,
  ): Promise<UploadJobQueuedDto> {
    if (!file?.path) {
      throw new BadRequestException(ApiExceptionMessage.MISSING_MULTIPART_FILE);
    }
    const policy = parseDuplicateNamePolicy(dup.duplicatePolicy, dup.overwrite);
    const t = this.tenant(account);
    const { finalFileName } = await this.storage.prepareAsyncUpload(t, folderId, file.originalname, policy);

    const job = await this.uploadQueue
      .add(FILE_UPLOAD_JOB_NAME, {
        tenant: t,
        tempPath: file.path,
        folderId,
        finalFileName,
        mimeType: file.mimetype,
        allowDuplicateContent: allowDuplicateContent === '1' || allowDuplicateContent === 'true',
      })
      .catch(async (err: unknown) => {
        await unlink(file.path).catch(() => undefined);
        throw err;
      });

    if (job.id === undefined) {
      await unlink(file.path).catch(() => undefined);
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
      const tenantChat =
        (job.data as FileUploadJobData | undefined)?.tenant?.telegramStorageChatId ?? '';
      dto.result = FileController.toSummary(
        job.returnvalue as StoredFile,
        this.runtime.telegramDownloadMaxBytes(),
        tenantChat,
      );
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
  async search(
    @CurrentAccount() account: Account,
    @Query() query: FileSearchQueryDto,
  ): Promise<FileSearchResponseDto> {
    const t = this.tenant(account);
    const items = await this.storage.searchFiles(t, {
      q: query.q,
      folderId: query.folderId,
      mode: query.mode ?? 'substring',
      limit: query.limit ?? 50,
      mimeType: query.mimeType,
      mimePrefix: query.mimePrefix,
      minSize: query.minSize,
      maxSize: query.maxSize,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      hasThumbnail: query.hasThumbnail,
      tags: query.tags,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return {
      items: items.map((f) =>
        FileController.toSummary(f, this.runtime.telegramDownloadMaxBytes(), t.telegramStorageChatId),
      ),
    };
  }

  @Post('meta/batch')
  @ApiOperation({
    summary: 'Metadata nhiều file',
    description: 'Tối đa 100 UUID; chỉ trả các id tìm thấy (giữ thứ tự trong body).',
  })
  @ApiBody({ type: FileMetaBatchRequestDto })
  @ApiOkResponse({ type: FileMetaBatchResponseDto })
  async metaBatch(
    @CurrentAccount() account: Account,
    @Body(ValidationPipe) body: FileMetaBatchRequestDto,
  ): Promise<FileMetaBatchResponseDto> {
    const items = await this.storage.getFilesMetaBatch(this.tenant(account), body.ids);
    return { items };
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
    @CurrentAccount() account: Account,
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
        resolvedFolder = ROOT_FOLDER_ALIAS;
      } else if (!isUuid(body.folderId)) {
        throw new BadRequestException(ApiExceptionMessage.INVALID_PATCH_FOLDER_ID);
      } else {
        resolvedFolder = body.folderId;
      }
    }
    const policy = parseDuplicateNamePolicy(dup.duplicatePolicy, dup.overwrite);
    const t = this.tenant(account);
    const saved = await this.storage.patchFile(
      t,
      id,
      { name: body.name, folderId: resolvedFolder },
      policy,
    );
    return FileController.toSummary(saved, this.runtime.telegramDownloadMaxBytes(), t.telegramStorageChatId);
  }

  @Get(':id/tags')
  @ApiOperation({ summary: 'Danh sách tag của file' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FileTagsResponseDto })
  async getTags(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileTagsResponseDto> {
    return {
      fileId: id,
      tags: await this.storage.getFileTags(this.tenant(account), id),
    };
  }

  @Patch(':id/tags')
  @ApiOperation({ summary: 'Gắn/thay thế tag cho file' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateFileTagsDto })
  @ApiOkResponse({ type: FileTagsResponseDto })
  async updateTags(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) body: UpdateFileTagsDto,
  ): Promise<FileTagsResponseDto> {
    const saved = await this.storage.setFileTags(this.tenant(account), id, body.tags);
    return {
      fileId: saved.id,
      tags: StorageService.tagsToNames(saved),
    };
  }

  @Post(`:id/${FileRoutePathSegment.SHARE_DOWNLOAD}`)
  @ApiOperation({
    summary: 'Tạo link tải/xem công khai (token có TTL)',
    description:
      'Cần Basic Auth. Người nhận chỉ cần URL có `token` — không cần Basic Auth. Cấu hình `PUBLIC_APP_URL` trong Cài đặt admin (không dấu `/` cuối) để có `downloadUrl` / `viewUrl` đầy đủ.',
  })
  @ApiBody({
    type: CreateShareDownloadDto,
    required: false,
    description: 'Tuỳ chọn `ttlSeconds` (60–604800; mặc định 86400)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ShareDownloadLinkResponseDto })
  @ApiNotFoundResponse({ description: 'Không tìm thấy file' })
  async createShareDownload(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) body: CreateShareDownloadDto,
  ): Promise<ShareDownloadLinkResponseDto> {
    await this.storage.getFile(this.tenant(account), id);
    const ttl = body.ttlSeconds ?? 86400;
    const { token, expiresAt } = this.shareDownloadToken.create(id, ttl);
    const base = `/${API_V1_PREFIX}/${SharedFilesRoutePath.BASE}`;
    const downloadPath = `${base}/${SharedFilesRoutePath.DOWNLOAD}?${SharedFilesQuery.TOKEN}=${encodeURIComponent(token)}`;
    const viewPath = `${base}/${SharedFilesRoutePath.VIEW}?${SharedFilesQuery.TOKEN}=${encodeURIComponent(token)}`;
    const publicBase = this.runtime.effectiveTrimmed(EnvKey.PUBLIC_APP_URL)?.replace(/\/+$/, '');
    const dto: ShareDownloadLinkResponseDto = {
      token,
      expiresAt,
      downloadPath,
      viewPath,
      ...(publicBase
        ? {
            downloadUrl: `${publicBase}${downloadPath}`,
            viewUrl: `${publicBase}${viewPath}`,
          }
        : {}),
    };
    return dto;
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
  async remove(@CurrentAccount() account: Account, @Param('id', ParseUUIDPipe) id: string) {
    await this.storage.deleteFile(this.tenant(account), id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Metadata file (JSON)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FileMetaResponseDto })
  async meta(@CurrentAccount() account: Account, @Param('id', ParseUUIDPipe) id: string) {
    const f = await this.storage.getFile(this.tenant(account), id);
    return {
      id: f.id,
      name: repairUtf8FilenameMojibake(f.name),
      mimeType: f.mimeType,
      size: f.size,
      folderId: f.folderId,
      createdAt: f.createdAt,
      hasThumbnail: !!f.thumbnailTelegramFileId,
      tags: StorageService.tagsToNames(f),
      canDirectDownload:
        !!f.s3ObjectKey || (!!f.telegramFileId && f.size <= this.runtime.telegramDownloadMaxBytes()),
      telegramMessageUrl: telegramPublicMessageUrl(
        f.telegramMessageId,
        this.tenant(account).telegramStorageChatId,
      ),
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
    await this.storage.streamOriginalToExpressResponse(
      id,
      res,
      ContentDispositionMode.ATTACHMENT,
    );
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
    await this.storage.streamOriginalToExpressResponse(
      id,
      res,
      ContentDispositionMode.INLINE,
    );
  }

  @Get(':id/thumbnail')
  @ApiOperation({ summary: 'Thumbnail JPEG (nếu có)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('image/jpeg')
  @ApiNotFoundResponse({ description: 'File không có thumbnail' })
  @ApiBadGatewayResponse({ description: 'Không tải được từ Telegram' })
  async thumbnail(
    @CurrentAccount() account: Account,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.storage.streamThumbnailToExpressResponse(
      this.tenant(account),
      id,
      res,
    );
  }

  private static toSummary(
    f: StoredFile,
    telegramMaxBytes: number,
    telegramStorageChatId: string,
  ): StoredFileSummaryDto {
    const skippedDuplicate = f as StoredFile & {
      skippedDuplicate?: boolean;
      skippedDuplicateReason?: string;
    };
    return {
      id: f.id,
      folderId: f.folderId,
      name: repairUtf8FilenameMojibake(f.name),
      mimeType: f.mimeType,
      size: f.size,
      telegramFileId: f.telegramFileId,
      telegramFileUniqueId: f.telegramFileUniqueId,
      contentSha256: f.contentSha256,
      s3Bucket: f.s3Bucket,
      s3ObjectKey: f.s3ObjectKey,
      thumbnailTelegramFileId: f.thumbnailTelegramFileId,
      telegramMessageId: f.telegramMessageId,
      tags: StorageService.tagsToNames(f),
      canDirectDownload:
        !!f.s3ObjectKey || (!!f.telegramFileId && f.size <= telegramMaxBytes),
      telegramMessageUrl: telegramPublicMessageUrl(f.telegramMessageId, telegramStorageChatId),
      skippedDuplicate: skippedDuplicate.skippedDuplicate,
      skippedDuplicateReason: skippedDuplicate.skippedDuplicateReason,
      createdAt: f.createdAt instanceof Date ? f.createdAt : new Date(f.createdAt as string),
    };
  }

  private static toTrashedFile(
    f: StoredFile,
    telegramMaxBytes: number,
    telegramStorageChatId: string,
  ): TrashedFileDto {
    const deletedAt = f.deletedAt instanceof Date ? f.deletedAt : new Date(f.deletedAt ?? Date.now());
    return {
      ...FileController.toSummary(f, telegramMaxBytes, telegramStorageChatId),
      deletedAt,
      deletedOriginalFolderId: f.deletedOriginalFolderId,
      deletedOriginalName: f.deletedOriginalName
        ? repairUtf8FilenameMojibake(f.deletedOriginalName)
        : f.deletedOriginalName,
    };
  }

  private static toTrashedFolder(folder: Folder): TrashedFolderDto {
    const deletedAt =
      folder.deletedAt instanceof Date ? folder.deletedAt : new Date(folder.deletedAt ?? Date.now());
    return {
      id: folder.id,
      parentId: folder.parentId,
      name: folder.deletedOriginalName ?? folder.name,
      createdAt: folder.createdAt instanceof Date ? folder.createdAt : new Date(folder.createdAt),
      deletedAt,
      deletedOriginalParentId: folder.deletedOriginalParentId,
      deletedOriginalName: folder.deletedOriginalName,
    };
  }

  private static toFolderForTrashView(folder: Folder): FolderResponseDto & Partial<TrashedFolderDto> {
    const dto: FolderResponseDto & Partial<TrashedFolderDto> = {
      id: folder.id,
      parentId: folder.parentId,
      name: folder.deletedOriginalName ?? folder.name,
      createdAt: folder.createdAt instanceof Date ? folder.createdAt : new Date(folder.createdAt),
    };
    if (folder.deletedAt) {
      dto.deletedAt = folder.deletedAt instanceof Date ? folder.deletedAt : new Date(folder.deletedAt);
      dto.deletedOriginalParentId = folder.deletedOriginalParentId;
      dto.deletedOriginalName = folder.deletedOriginalName;
    }
    return dto;
  }
}
