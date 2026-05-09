import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Readable } from 'stream';
import { StorageService } from './storage.service';

function contentDisposition(mode: 'inline' | 'attachment', name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_');
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

@Controller('files')
export class FileController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
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

  @Get(':id')
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
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.pipeOriginal(id, res, 'attachment');
  }

  /** Hiển thị trong trình duyệt (ảnh/PDF tùy MIME) */
  @Get(':id/view')
  async view(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.pipeOriginal(id, res, 'inline');
  }

  @Get(':id/thumbnail')
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
