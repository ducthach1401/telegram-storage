import { ApiProperty } from '@nestjs/swagger';

export class MysqlImportResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
