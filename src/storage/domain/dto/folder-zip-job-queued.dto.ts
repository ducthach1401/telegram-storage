import { ApiProperty } from '@nestjs/swagger';

export class FolderZipJobQueuedDto {
  @ApiProperty({ description: 'Tra cứu GET …/folders/download/jobs/:jobId' })
  jobId: string;
}
