import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { Folder } from '../storage/domain/entities/folder.entity';
import { Account } from './account.entity';
import { AccountService } from './account.service';
import { AccountsPublicController } from './accounts-public.controller';
import { AdminAccountsController } from './admin-accounts.controller';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    SettingsModule,
    forwardRef(() => StorageModule),
    TypeOrmModule.forFeature([Account, Folder]),
  ],
  controllers: [AccountsPublicController, AdminAccountsController],
  providers: [AccountService, RolesGuard],
  exports: [AccountService, RolesGuard],
})
export class AccountsModule {}
