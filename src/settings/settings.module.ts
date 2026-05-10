import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './app-setting.entity';
import { RuntimeConfigService } from './runtime-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting])],
  providers: [RuntimeConfigService],
  exports: [RuntimeConfigService],
})
export class SettingsModule {}
