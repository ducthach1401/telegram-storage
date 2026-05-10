import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountRole } from './account-role.enum';
import { AccountService } from './account.service';
import { CreateAccountAdminDto } from './dto/create-account-admin.dto';
import { UpdateAccountQuotaDto } from './dto/update-account-quota.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { API_V1_PREFIX } from '../common/api-route';

@ApiTags('admin-accounts')
@ApiBearerAuth()
@Controller(`${API_V1_PREFIX}/admin/accounts`)
@UseGuards(RolesGuard)
@Roles(AccountRole.ADMIN)
export class AdminAccountsController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách account (không trả password)' })
  @ApiOkResponse()
  async list() {
    const rows = await this.accounts.listAccounts();
    return rows.map((a) => ({
      id: a.id,
      username: a.username,
      role: a.role,
      minioLimitGb: a.minioLimitGb,
      rootFolderId: a.rootFolderId,
      telegramUsePlatformDefaults: a.telegramUsePlatformDefaults,
      hasTelegram:
        a.telegramUsePlatformDefaults ||
        Boolean(a.telegramBotToken && a.telegramStorageChatId),
      createdAt: a.createdAt,
    }));
  }

  @Post()
  @ApiOperation({ summary: 'Tạo admin hoặc user' })
  @ApiCreatedResponse()
  async create(@Body() dto: CreateAccountAdminDto) {
    const acc = await this.accounts.createAccountByAdmin({
      username: dto.username,
      password: dto.password,
      role: dto.role,
      minioLimitGb: dto.minioLimitGb,
      telegramUsePlatformDefaults: dto.telegramUsePlatformDefaults ?? false,
      telegramBotToken: dto.telegramBotToken ?? null,
      telegramStorageChatId: dto.telegramStorageChatId ?? null,
    });
    return {
      id: acc.id,
      username: acc.username,
      role: acc.role,
      minioLimitGb: acc.minioLimitGb,
      rootFolderId: acc.rootFolderId,
    };
  }

  @Patch(':id/quota')
  @ApiOperation({ summary: 'Đặt quota MinIO (GB) cho user' })
  async setQuota(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountQuotaDto,
  ) {
    const acc = await this.accounts.updateAccountQuota(id, dto.minioLimitGb);
    return { id: acc.id, minioLimitGb: acc.minioLimitGb };
  }
}
