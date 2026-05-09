import { ApiProperty } from '@nestjs/swagger';

export class QueueStatsResponseDto {
  @ApiProperty({ example: 'file-upload' })
  queueName: string;

  @ApiProperty({
    description: 'Số job theo từng trạng thái (BullMQ)',
    example: { waiting: 0, active: 1, failed: 3, completed: 120 },
  })
  counts: Record<string, number>;

  @ApiProperty({ description: 'Queue có đang pause không' })
  isPaused: boolean;
}
