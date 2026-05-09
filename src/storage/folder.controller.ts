import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { CreateFolderDto } from './dto/create-folder.dto';
import { StorageService } from './storage.service';

@Controller('folders')
export class FolderController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  create(@Body(ValidationPipe) dto: CreateFolderDto) {
    return this.storage.createFolder(dto);
  }

  /** `folderId` = `root` hoặc UUID */
  @Get(':folderId/contents')
  listContents(@Param('folderId') folderId: string) {
    if (folderId !== 'root' && !isUuid(folderId)) {
      throw new BadRequestException('folderId phải là "root" hoặc UUID hợp lệ');
    }
    return this.storage.listContents(folderId);
  }
}
