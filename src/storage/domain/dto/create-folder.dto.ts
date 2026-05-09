import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateFolderDto {
  /** Bỏ qua hoặc đặt id thư mục cha; mặc định là thư mục gốc */
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;
}
