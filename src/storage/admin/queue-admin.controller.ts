import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Job, Queue } from 'bullmq';
import { API_V1_PREFIX } from '../../common/api-route';
import { FILE_UPLOAD_QUEUE } from '../queue/file-upload.constants';
import type { FileUploadJobData } from '../queue/file-upload.processor';
import {
  AdminControllerPath,
  AdminQueueSubRoute,
} from './admin.routes';
import { QueueJobSummaryDto } from './dto/queue-job-summary.dto';
import { QueueJobsListResponseDto } from './dto/queue-jobs-list-response.dto';
import { QueueJobsQueryDto } from './dto/queue-jobs-query.dto';
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

  private static async jobToSummary(job: Job): Promise<QueueJobSummaryDto> {
    return {
      id: job.id !== undefined ? String(job.id) : undefined,
      name: job.name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? undefined,
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? undefined,
      finishedOn: job.finishedOn ?? undefined,
    };
  }
}
