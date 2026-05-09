import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { JobType } from 'bullmq';

/** Trạng thái hợp lệ khi liệt kê job (một loại mỗi request). */
export const QUEUE_JOB_QUERY_STATES: JobType[] = [
  'waiting',
  'active',
  'delayed',
  'failed',
  'completed',
  'prioritized',
  'waiting-children',
];

export class QueueJobsQueryDto {
  @ApiPropertyOptional({
    enum: QUEUE_JOB_QUERY_STATES,
    description: 'Mặc định: failed',
  })
  @IsOptional()
  @IsIn(QUEUE_JOB_QUERY_STATES)
  state?: JobType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start?: number;

  @ApiPropertyOptional({ default: 19, description: 'Chỉ số kết thúc (BullMQ), lấy tối đa end−start+1 job' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  end?: number;
}
