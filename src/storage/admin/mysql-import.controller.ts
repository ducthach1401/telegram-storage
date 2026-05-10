import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { unlink } from 'fs/promises';
import { AccountRole } from '../../accounts/account-role.enum';
import { Roles } from '../../accounts/roles.decorator';
import { RolesGuard } from '../../accounts/roles.guard';
import { ApiExceptionMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import { FileMultipart } from '../storage-http.constants';
import { MysqlImportResponseDto } from '../domain/dto/mysql-import-response.dto';
import {
  AdminControllerPath,
  AdminMysqlSubRoute,
} from './admin.routes';
import { MysqlImportMulterInterceptor } from '../interceptors/mysql-import-file.interceptor';
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
@UseGuards(RolesGuard)
@Roles(AccountRole.ADMIN)
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
  @UseInterceptors(MysqlImportMulterInterceptor)
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
