import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../auth/public.decorator';
import { ApiExceptionMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import {
  ContentDispositionMode,
  MimeType,
} from '../../common/http.constants';
import { SharedFilesQuery, SharedFilesRoutePath } from '../storage-http.constants';
import { StorageService } from '../storage.service';
import { ShareDownloadTokenService } from '../share/share-download-token.service';

@Public()
@ApiTags('shared')
@Controller(`${API_V1_PREFIX}/${SharedFilesRoutePath.BASE}`)
export class SharedFileController {
  constructor(
    private readonly storage: StorageService,
    private readonly shareToken: ShareDownloadTokenService,
  ) {}

  @Get(SharedFilesRoutePath.DOWNLOAD)
  @ApiOperation({
    summary: 'Tải file qua link chia sẻ',
    description:
      '**Không cần Basic Auth.** Query `token` từ `POST …/files/:id/share-download`.',
    security: [],
  })
  @ApiProduces('application/octet-stream')
  @ApiQuery({ name: SharedFilesQuery.TOKEN, required: true })
  @ApiUnauthorizedResponse({ description: 'Token sai hoặc hết hạn' })
  @ApiBadRequestResponse({ description: 'Thiếu token' })
  @ApiOkResponse({ description: 'Stream file (attachment)' })
  async sharedDownload(
    @Query(SharedFilesQuery.TOKEN) token: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!token?.trim()) {
      throw new BadRequestException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    const fileId = this.shareToken.verifyFileId(token.trim());
    await this.storage.streamOriginalToExpressResponse(
      fileId,
      res,
      ContentDispositionMode.ATTACHMENT,
    );
  }

  @Get(SharedFilesRoutePath.VIEW)
  @ApiOperation({
    summary: 'Xem file inline qua link chia sẻ',
    description: 'Không cần Basic Auth — cùng token như download.',
    security: [],
  })
  @ApiProduces(
    MimeType.OCTET_STREAM,
    'image/*',
    'application/pdf',
  )
  @ApiQuery({ name: SharedFilesQuery.TOKEN, required: true })
  @ApiUnauthorizedResponse({ description: 'Token sai hoặc hết hạn' })
  async sharedView(
    @Query(SharedFilesQuery.TOKEN) token: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!token?.trim()) {
      throw new BadRequestException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    const fileId = this.shareToken.verifyFileId(token.trim());
    await this.storage.streamOriginalToExpressResponse(
      fileId,
      res,
      ContentDispositionMode.INLINE,
    );
  }
}
