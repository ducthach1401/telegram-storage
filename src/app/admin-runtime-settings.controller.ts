import { Body, Controller, Get, Patch, UseGuards, ValidationPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountService } from '../accounts/account.service';
import { AccountRole } from '../accounts/account-role.enum';
import { Roles } from '../accounts/roles.decorator';
import { RolesGuard } from '../accounts/roles.guard';
import { API_V1_PREFIX } from '../common/api-route';
import { MysqlBackupSchedulerService } from '../backup/mysql-backup.scheduler';
import { RuntimeConfigService } from '../settings/runtime-config.service';
import { UpdateAdminSettingsDto } from '../settings/dto/update-admin-settings.dto';
import { TelegramService } from '../storage/telegram/telegram.service';

@ApiTags('admin-settings')
@ApiBearerAuth()
@Controller(`${API_V1_PREFIX}/admin/settings`)
@UseGuards(RolesGuard)
@Roles(AccountRole.ADMIN)
export class AdminRuntimeSettingsController {
  constructor(
    private readonly runtime: RuntimeConfigService,
    private readonly mysqlBackup: MysqlBackupSchedulerService,
    private readonly telegram: TelegramService,
    private readonly accounts: AccountService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Cấu hình vận hành (runtime)',
    description:
      'Khi khởi động, các khóa Cài đặt server thiếu được tạo trong `app_settings` (lần đầu có thể lấy từ env). Khi đã có trong DB, giá trị hiệu lực chỉ từ DB — không fallback env. `TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID` / `TELEGRAM_ALERT_CHAT_ID` không fallback env nếu chưa có dòng DB. Bot token trên admin đầu tiên. UPLOAD_QUEUE_* chỉ đọc khi worker khởi động.',
  })
  @ApiOkResponse()
  get(): {
    effective: Record<string, string | number | boolean>;
    overriddenKeys: string[];
    queueWorkerEnv: Record<string, number>;
    queueWorkerHint: string;
  } {
    return {
      effective: this.runtime.getAdminEffectivePayload(),
      overriddenKeys: this.runtime.overrideKeys(),
      queueWorkerEnv: this.runtime.queueEnvSnapshot(),
      queueWorkerHint:
        'UPLOAD_QUEUE_CONCURRENCY / ATTEMPTS / BACKOFF chỉ áp dụng sau khi đổi env và khởi động lại worker.',
    };
  }

  @Patch()
  @ApiOperation({
    summary: 'Cập nhật cấu hình runtime',
    description:
      'Gửi `null` để xóa override trong DB. Với khóa Telegram chỉ-DB, xóa = chưa cấu hình (không fallback env). Sau PATCH webhook Telegram được thử refresh (production).',
  })
  @ApiOkResponse()
  async patch(@Body(ValidationPipe) body: UpdateAdminSettingsDto): Promise<{
    effective: Record<string, string | number | boolean>;
    overriddenKeys: string[];
    queueWorkerEnv: Record<string, number>;
    queueWorkerHint: string;
    webhook: Awaited<ReturnType<TelegramService['refreshWebhookIfConfigured']>>;
  }> {
    await this.runtime.persistAdminPatch(body);
    await this.accounts.refreshPlatformTelegramMergeDefaults();
    await this.mysqlBackup.refreshScheduleFromRuntime();
    const webhook = await this.telegram.refreshWebhookIfConfigured();
    return {
      effective: this.runtime.getAdminEffectivePayload(),
      overriddenKeys: this.runtime.overrideKeys(),
      queueWorkerEnv: this.runtime.queueEnvSnapshot(),
      queueWorkerHint:
        'UPLOAD_QUEUE_CONCURRENCY / ATTEMPTS / BACKOFF chỉ áp dụng sau khi đổi env và khởi động lại worker.',
      webhook,
    };
  }
}
