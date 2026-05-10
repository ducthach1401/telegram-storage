import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountRole } from '../../accounts/account-role.enum';
import { Roles } from '../../accounts/roles.decorator';
import { RolesGuard } from '../../accounts/roles.guard';
import { API_V1_PREFIX } from '../../common/api-route';
import {
  AdminControllerPath,
  AdminReconcileSubRoute,
} from './admin.routes';
import { ReconcileRequestDto } from './dto/reconcile-request.dto';
import { ReconcileResponseDto } from './dto/reconcile-response.dto';
import { ReconcileService } from './reconcile.service';

@ApiTags('admin')
@Controller(`${API_V1_PREFIX}/${AdminControllerPath.RECONCILE}`)
@UseGuards(RolesGuard)
@Roles(AccountRole.ADMIN)
export class ReconcileController {
  constructor(private readonly reconcile: ReconcileService) {}

  @Post(AdminReconcileSubRoute.FILES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reconcile / cleanup file trong DB với Telegram',
    description:
      'Quét bản ghi `stored_files`, gọi getFile(file_id). Nếu Telegram không còn phục vụ document đó: dryRun chỉ đếm; ngược lại xóa metadata DB và best-effort deleteMessage. Nên giữ delayMsBetweenChecks > 0 để tránh flood Telegram.',
  })
  @ApiOkResponse({ type: ReconcileResponseDto })
  async reconcileFiles(
    @Body() body: ReconcileRequestDto,
  ): Promise<ReconcileResponseDto> {
    return this.reconcile.reconcileStoredFiles(body);
  }
}
