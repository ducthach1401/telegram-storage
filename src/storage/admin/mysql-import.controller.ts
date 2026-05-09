import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { ApiExceptionMessage } from '../../common/api-messages';
import { EnvKey } from '../../common/env-keys';
import { API_V1_PREFIX } from '../../common/api-route';
import { FileMultipart } from '../storage-http.constants';
import { MysqlImportResponseDto } from '../domain/dto/mysql-import-response.dto';
import {
  AdminControllerPath,
  AdminMysqlSubRoute,
} from './admin.routes';
import { MysqlImportService } from './mysql-import.service';

function dumpFilenameSuffix(original: string): string {
  const l = original.toLowerCase();
  if (l.endsWith('.sql.gz')) {
    return '.sql.gz';
  }
  if (l.endsWith('.gz')) {
    return '.gz';
  }
  if (l.endsWith('.sql')) {
    return '.sql';
  }
  return '';
}

@ApiTags('admin')
@Controller(`${API_V1_PREFIX}/${AdminControllerPath.MYSQL}`)
export class MysqlImportController {
  constructor(private readonly mysqlImport: MysqlImportService) {}

  @Post(AdminMysqlSubRoute.IMPORT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import dump MySQL (SQL hoặc gzip)',
    description:
      'Multipart field `file`: `.sql` hoặc `.sql.gz`. **Nguy hiểm:** có thể ghi đè/xóa dữ liệu tùy nội dung dump — chỉ dùng dump tin cậy. Cần **Basic Auth**. Image prod có `mysql` (mariadb-client).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [FileMultipart.FIELD_FILE],
      properties: {
        [FileMultipart.FIELD_FILE]: {
          type: 'string',
          format: 'binary',
          description: 'File .sql hoặc .sql.gz',
        },
      },
    },
  })
  @ApiOkResponse({ type: MysqlImportResponseDto })
  @ApiBadRequestResponse({
    description: 'Thiếu file / sai đuôi / mysql báo lỗi (stderr trong body)',
  })
  @UseInterceptors(
    FileInterceptor(FileMultipart.FIELD_FILE, {
      limits: {
        fileSize:
          (Number(process.env[EnvKey.MYSQL_IMPORT_MAX_MB]) || 512) *
          1024 *
          1024,
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const base =
            process.env[EnvKey.UPLOAD_TMP_DIR]?.trim() ||
            join(process.cwd(), 'tmp', 'uploads');
          const dir = join(base, 'mysql-import');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const suf = dumpFilenameSuffix(file.originalname);
          cb(null, `${randomUUID()}${suf}`);
        },
      }),
    }),
  )
  async importDump(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MysqlImportResponseDto> {
    if (!file?.path) {
      throw new BadRequestException(ApiExceptionMessage.MISSING_MULTIPART_FILE);
    }
    if (!dumpFilenameSuffix(file.originalname)) {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        'Tên file cần có đuôi .sql hoặc .sql.gz (hoặc .gz)',
      );
    }

    try {
      await this.mysqlImport.importFromUploadedDumpPath(file.path);
      return { ok: true };
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }
}
