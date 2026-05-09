import { ApiProperty } from '@nestjs/swagger';

export class QueueWorkersResponseDto {
  @ApiProperty({
    description: 'Danh sách worker Redis (dạng key/value tuỳ BullMQ)',
    type: 'array',
    items: { type: 'object', additionalProperties: { type: 'string' } },
  })
  workers: Record<string, string>[];
}
