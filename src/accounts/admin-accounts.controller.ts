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
import type { Account } from './account.entity';
import { CurrentAccount } from './current-account.decorator';
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
import { PatchAdminAccountDto } from './dto/patch-admin-account.dto';
import { UpdateAccountQuotaDto } from './dto/update-account-quota.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { API_V1_PREFIX } from '../common/api-route';
import { StorageService } from '../storage/storage.service';

@ApiTags('admin-accounts')
@ApiBearerAuth()
@Controller(`${API_V1_PREFIX}/admin/accounts`)
@UseGuards(RolesGuard)
@Roles(AccountRole.ADMIN)
export class AdminAccountsController {
  constructor(
    private readonly accounts: AccountService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách account (không trả password)' })
  @ApiOkResponse()
  async list() {
    const rows = await this.accounts.listAccounts();
    const usage = await this.storage.getAdminAccountsStorageUsage(
      rows.map((account) => ({
        id: account.id,
        minioLimitGb: account.minioLimitGb,
      })),
    );
    return rows.map((a) => ({
      id: a.id,
      username: a.username,
      role: a.role,
      minioLimitGb: a.minioLimitGb,
      isActive: a.isActive,
      rootFolderId: a.rootFolderId,
      telegramUsePlatformDefaults: a.telegramUsePlatformDefaults,
      hasTelegram:
        a.telegramUsePlatformDefaults ||
        Boolean(a.telegramBotToken && a.telegramStorageChatId),
      createdAt: a.createdAt,
      telegramBytes: usage[a.id]?.telegramBytes ?? 0,
      minioBytes: usage[a.id]?.minioBytes ?? 0,
      minioLimitBytes: usage[a.id]?.minioLimitBytes ?? 0,
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

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật role, quota MinIO và trạng thái hoạt động',
  })
  async patchAccount(
    @CurrentAccount() actor: Account,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchAdminAccountDto,
  ) {
    const acc = await this.accounts.updateAccountByAdmin(
      id,
      {
        role: dto.role,
        minioLimitGb: dto.minioLimitGb,
        isActive: dto.isActive,
      },
      { actorId: actor.id },
    );
    return {
      id: acc.id,
      username: acc.username,
      role: acc.role,
      minioLimitGb: acc.minioLimitGb,
      isActive: acc.isActive,
    };
  }
}
