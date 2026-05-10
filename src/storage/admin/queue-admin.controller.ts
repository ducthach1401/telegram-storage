import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Job, Queue } from 'bullmq';
import { stat, unlink } from 'fs/promises';
import { ApiExceptionMessage } from '../../common/api-messages';
import { API_V1_PREFIX } from '../../common/api-route';
import {
  BullMqJobState,
  FILE_UPLOAD_QUEUE,
} from '../queue/file-upload.constants';
import type { FileUploadJobData } from '../queue/file-upload.processor';
import {
  AdminControllerPath,
  AdminQueueSubRoute,
} from './admin.routes';
import { QueueJobSummaryDto } from './dto/queue-job-summary.dto';
import { QueueJobsListResponseDto } from './dto/queue-jobs-list-response.dto';
import { QueueJobsQueryDto } from './dto/queue-jobs-query.dto';
import { QueueRetryResponseDto } from './dto/queue-retry-response.dto';
import { QueueStatsResponseDto } from './dto/queue-stats-response.dto';
import { QueueWorkersResponseDto } from './dto/queue-workers-response.dto';

@ApiTags('admin')
@Controller(`${API_V1_PREFIX}/${AdminControllerPath.QUEUE}`)
export class QueueAdminController {
  constructor(
    @InjectQueue(FILE_UPLOAD_QUEUE)
    private readonly uploadQueue: Queue<FileUploadJobData>,
  ) {}

  @Get(AdminQueueSubRoute.STATS)
  @ApiOperation({
    summary: 'Thống kê trạng thái queue upload (BullMQ)',
    description:
      'Đếm job theo từng trạng thái và cho biết queue có đang pause hay không.',
  })
  @ApiOkResponse({ type: QueueStatsResponseDto })
  async stats(): Promise<QueueStatsResponseDto> {
    const [counts, isPaused] = await Promise.all([
      this.uploadQueue.getJobCounts(),
      this.uploadQueue.isPaused(),
    ]);
    return {
      queueName: FILE_UPLOAD_QUEUE,
      counts,
      isPaused,
    };
  }

  @Get(AdminQueueSubRoute.JOBS)
  @ApiOperation({
    summary: 'Liệt kê job theo một trạng thái',
    description:
      'Mặc định xem job failed. Không trả payload job.data (có đường dẫn file tạm).',
  })
  @ApiOkResponse({ type: QueueJobsListResponseDto })
  async jobs(@Query() query: QueueJobsQueryDto): Promise<QueueJobsListResponseDto> {
    const state = query.state ?? 'failed';
    const start = query.start ?? 0;
    const end = query.end ?? 19;
    const raw = await this.uploadQueue.getJobs(state, start, end);
    const jobs: QueueJobSummaryDto[] = await Promise.all(
      raw.map((job) => QueueAdminController.jobToSummary(job)),
    );
    return { jobs };
  }

  @Post(AdminQueueSubRoute.RETRY_FAILED)
  @ApiOperation({
    summary: 'Retry tất cả job upload failed',
    description:
      'Đưa các job failed còn file tạm về queue để worker re-upload. Không retry job thiếu file tạm.',
  })
  @ApiOkResponse({ type: QueueRetryResponseDto })
  async retryFailed(@Query() query: QueueJobsQueryDto): Promise<QueueRetryResponseDto> {
    const start = query.start ?? 0;
    const end = query.end ?? 49;
    const failedJobs = await this.uploadQueue.getJobs(BullMqJobState.FAILED, start, end);
    let retried = 0;
    let skipped = 0;
    const jobs: QueueJobSummaryDto[] = [];

    for (const job of failedJobs) {
      if (!(await QueueAdminController.canRetryUploadJob(job))) {
        skipped++;
        jobs.push(await QueueAdminController.jobToSummary(job));
        continue;
      }
      try {
        await job.retry();
        retried++;
      } catch {
        skipped++;
      }
      jobs.push(await QueueAdminController.jobToSummary(job));
    }

    return { retried, skipped, jobs };
  }

  @Post(AdminQueueSubRoute.RETRY_JOB)
  @ApiOperation({
    summary: 'Retry một job upload failed',
    description: 'Dùng khi job đã hết retry tự động nhưng file tạm vẫn còn để re-upload.',
  })
  @ApiParam({ name: 'jobId' })
  @ApiOkResponse({ type: QueueJobSummaryDto })
  @ApiNotFoundResponse({ description: 'Không có job' })
  @ApiBadRequestResponse({ description: 'Job chưa failed hoặc không còn file tạm' })
  async retryJob(@Param('jobId') jobId: string): Promise<QueueJobSummaryDto> {
    const job = await this.uploadQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(ApiExceptionMessage.JOB_NOT_FOUND);
    }
    const state = await job.getState();
    if (state !== BullMqJobState.FAILED) {
      throw new BadRequestException('Chỉ retry được job đang ở trạng thái failed');
    }
    if (!(await QueueAdminController.tempFileExists(job.data.tempPath))) {
      throw new BadRequestException(
        'Không retry được vì file tạm đã mất; cần upload lại file từ client',
      );
    }
    await job.retry();
    return QueueAdminController.jobToSummary(job);
  }

  @Delete(AdminQueueSubRoute.DELETE_JOB)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa job upload failed và file tạm',
    description:
      'Dùng để bỏ hẳn file đang nằm trong queue retry. Chỉ xóa job failed để tránh hủy upload đang chạy.',
  })
  @ApiParam({ name: 'jobId' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Không có job' })
  @ApiBadRequestResponse({ description: 'Job chưa failed' })
  async deleteJob(@Param('jobId') jobId: string): Promise<void> {
    const job = await this.uploadQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(ApiExceptionMessage.JOB_NOT_FOUND);
    }
    const state = await job.getState();
    if (state !== BullMqJobState.FAILED) {
      throw new BadRequestException('Chỉ xóa được job upload đang failed');
    }
    await QueueAdminController.deleteTempFile(job.data.tempPath);
    await job.remove();
  }

  @Get(AdminQueueSubRoute.WORKERS)
  @ApiOperation({
    summary: 'Worker đang đăng ký cho queue (Redis)',
    description: 'Tuỳ hạ tầng Redis; có thể rỗng nếu không hỗ trợ SETNAME.',
  })
  @ApiOkResponse({ type: QueueWorkersResponseDto })
  async workers(): Promise<QueueWorkersResponseDto> {
    const workers = await this.uploadQueue.getWorkers();
    return { workers };
  }

  private static async jobToSummary(job: Job<FileUploadJobData>): Promise<QueueJobSummaryDto> {
    const state = await job.getState();
    return {
      id: job.id !== undefined ? String(job.id) : undefined,
      name: job.name,
      state,
      attemptsMade: job.attemptsMade,
      attempts: job.opts.attempts,
      fileName: job.data.finalFileName,
      mimeType: job.data.mimeType,
      canRetry:
        state === BullMqJobState.FAILED &&
        (await QueueAdminController.tempFileExists(job.data.tempPath)),
      failedReason: job.failedReason ?? undefined,
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? undefined,
      finishedOn: job.finishedOn ?? undefined,
    };
  }

  private static async canRetryUploadJob(job: Job<FileUploadJobData>): Promise<boolean> {
    return (
      (await job.getState()) === BullMqJobState.FAILED &&
      (await QueueAdminController.tempFileExists(job.data.tempPath))
    );
  }

  private static async tempFileExists(tempPath: string): Promise<boolean> {
    try {
      const st = await stat(tempPath);
      return st.isFile();
    } catch {
      return false;
    }
  }

  private static async deleteTempFile(tempPath: string): Promise<void> {
    try {
      await unlink(tempPath);
    } catch {
      /* File tạm có thể đã bị dọn trước đó; vẫn xóa job để bỏ khỏi retry. */
    }
  }
}
