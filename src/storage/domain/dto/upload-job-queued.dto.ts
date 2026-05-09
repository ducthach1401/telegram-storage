import { ApiProperty } from '@nestjs/swagger';

export class UploadJobQueuedDto {
  @ApiProperty({ description: 'Job id trên queue (tra cứu GET …/upload/jobs/:jobId)' })
  jobId: string;
}
