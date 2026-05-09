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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { Readable } from 'stream';
import { API_V1_PREFIX } from '../../common/api-route';
import { FileMetaResponseDto } from '../domain/dto/file-meta-response.dto';
import { StoredFileSummaryDto } from '../domain/dto/stored-file-summary.dto';
import { UploadJobQueuedDto } from '../domain/dto/upload-job-queued.dto';
import { UploadJobStatusDto } from '../domain/dto/upload-job-status.dto';
import { StoredFile } from '../domain/entities/stored-file.entity';
import { asyncUploadDiskStorage } from '../multer-async-disk.storage';
import { FILE_UPLOAD_QUEUE } from '../queue/file-upload.constants';
import type { FileUploadJobData } from '../queue/file-upload.processor';
import { StorageService } from '../storage.service';

function contentDisposition(mode: 'inline' | 'attachment', name: string): string {
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

  @Post('upload')
  @ApiOperation({ summary: 'Upload file (multipart)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Nội dung file',
        },
        folderId: {
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
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('folderId') folderId?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Thiếu file (form field `file`)');
    }
    return this.storage.saveUploadedFile(folderId, file.originalname, file.mimetype, file.buffer);
  }

  @Post('upload/async')
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
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folderId: {
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: asyncUploadDiskStorage,
      limits: {
        fileSize: Number(process.env.MAX_UPLOAD_MB ?? '50') * 1024 * 1024,
      },
    }),
  )
  async uploadAsync(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('folderId') folderId?: string,
  ): Promise<UploadJobQueuedDto> {
    if (!file?.path) {
      throw new BadRequestException('Thiếu file (form field `file`)');
    }
    await this.storage.prepareAsyncUpload(folderId, file.originalname);

    const job = await this.uploadQueue.add('persist', {
      tempPath: file.path,
      folderId,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    if (job.id === undefined) {
      throw new BadGatewayException('Không tạo được job trên queue');
    }

    return { jobId: String(job.id) };
  }

  @Get('upload/jobs/:jobId')
  @ApiOperation({ summary: 'Trạng thái job upload async' })
  @ApiParam({ name: 'jobId', description: 'Giá trị jobId từ POST upload/async' })
  @ApiOkResponse({ type: UploadJobStatusDto })
  @ApiNotFoundResponse({ description: 'Không có job' })
  async uploadJobStatus(@Param('jobId') jobId: string): Promise<UploadJobStatusDto> {
    const job = await this.uploadQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Không tìm thấy job');
    }

    const state = await job.getState();
    const dto: UploadJobStatusDto = {
      jobId: String(job.id),
      state,
    };

    if (state === 'completed' && job.returnvalue != null) {
      dto.result = FileController.toSummary(job.returnvalue as StoredFile);
    }
    if (state === 'failed') {
      dto.failedReason = job.failedReason ?? undefined;
    }

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
    await this.pipeOriginal(id, res, 'attachment');
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
    await this.pipeOriginal(id, res, 'inline');
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
      throw new NotFoundException('File không có thumbnail');
    }
    const url = await this.storage.getDownloadUrl(thumbId);
    const r = await fetch(url);
    if (!r.ok || !r.body) {
      throw new BadGatewayException('Không tải được thumbnail từ Telegram');
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
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
    disposition: 'inline' | 'attachment',
  ) {
    const f = await this.storage.getFile(id);
    const url = await this.storage.getDownloadUrl(f.telegramFileId);
    const r = await fetch(url);
    if (!r.ok || !r.body) {
      throw new BadGatewayException('Không tải được file từ Telegram');
    }
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(disposition, f.name));
    Readable.fromWeb(r.body as import('stream/web').ReadableStream).pipe(res);
  }
}
