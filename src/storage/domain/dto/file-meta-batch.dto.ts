import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { FileMetaResponseDto } from './file-meta-response.dto';

export class FileMetaBatchRequestDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    maxItems: 100,
    description: 'Tối đa 100 UUID',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class FileMetaBatchResponseDto {
  @ApiProperty({ type: [FileMetaResponseDto] })
  items: FileMetaResponseDto[];
}
