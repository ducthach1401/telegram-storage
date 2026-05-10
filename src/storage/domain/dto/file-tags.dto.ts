import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFileTagsDto {
  @ApiProperty({
    type: [String],
    example: ['backup', 'invoice'],
    description: 'Danh sách tag gắn cho file. Tag rỗng bị bỏ qua, tối đa 20 tag.',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  tags: string[];
}

export class FileTagsResponseDto {
  @ApiProperty({ format: 'uuid' })
  fileId: string;

  @ApiProperty({ type: [String] })
  tags: string[];
}
