import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnvKey } from '../common/env-keys';
import { UploadDefaults } from '../common/upload.defaults';
import { RuntimeConfigService } from '../settings/runtime-config.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ROOT_FOLDER_ID,
  VIRTUAL_ROOT_FOLDER_NAME,
} from '../storage/domain/constants';
import { Folder } from '../storage/domain/entities/folder.entity';
import { AccountRole } from './account-role.enum';
import { Account } from './account.entity';
import { hashPassword } from './password-hash.util';

export interface RegisterAccountInput {
  username: string;
  password: string;
  /** Mặc định true — dùng bot/chat của admin đầu tiên; false = bắt buộc token + chat riêng. */
  usePlatformTelegramStorage?: boolean;
  telegramBotToken?: string;
  telegramStorageChatId?: string;
}

export interface CreateAccountAdminInput {
  username: string;
  password: string;
  role: AccountRole;
  minioLimitGb: number;
  telegramUsePlatformDefaults?: boolean;
  telegramBotToken?: string | null;
  telegramStorageChatId?: string | null;
}

@Injectable()
export class AccountService {
  private primaryAdminId: string | null = null;

  /** Bot từ admin đầu tiên + chat lưu: **ưu tiên** `TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID` (Cài đặt server), không có thì chat trên admin đầu tiên. */
  private platformMergeDefaults: {
    telegramBotToken: string;
    telegramStorageChatId: string;
  } | null = null;

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Folder)
    private readonly folderRepo: Repository<Folder>,
    private readonly runtime: RuntimeConfigService,
  ) {}

  /** Cache để `/auth/verify` biết admin đầu tiên (sync). */
  isPrimaryAdminSync(accountId: string): boolean {
    return this.primaryAdminId !== null && this.primaryAdminId === accountId;
  }

  /** Đồng bộ nhánh merge tenant (`telegramUsePlatformDefaults`). */
  getPlatformTelegramMergeDefaultsSync(): {
    telegramBotToken: string;
    telegramStorageChatId: string;
  } | null {
    return this.platformMergeDefaults;
  }

  async refreshPlatformTelegramMergeDefaults(): Promise<void> {
    const admin = await this.findPrimaryAdmin();
    this.primaryAdminId = admin?.id ?? null;
    if (!admin) {
      this.platformMergeDefaults = null;
      return;
    }
    const token = (admin.telegramBotToken ?? '').trim();
    const sharedChat = (
      this.runtime.effectiveTrimmed(EnvKey.TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID) ?? ''
    ).trim();
    const adminChat = (admin.telegramStorageChatId ?? '').trim();
    const chat = sharedChat || adminChat;
    if (!token || !chat) {
      this.platformMergeDefaults = null;
      return;
    }
    this.platformMergeDefaults = { telegramBotToken: token, telegramStorageChatId: chat };
  }

  /**
   * Bootstrap DB + migration folder `accountId` NULL.
   * Không tự tạo admin — **tài khoản đầu** đăng ký qua `POST /auth/register` là admin (xem `registerUser`).
   */
  async bootstrapFromEnvIfEmpty(): Promise<void> {
    const primaryAdmin = await this.findPrimaryAdmin();

    let root = await this.folderRepo.findOne({ where: { id: ROOT_FOLDER_ID } });
    if (!root) {
      root = await this.folderRepo.save(
        this.folderRepo.create({
          id: ROOT_FOLDER_ID,
          parentId: null,
          name: VIRTUAL_ROOT_FOLDER_NAME,
          accountId: primaryAdmin?.id ?? null,
        }),
      );
    } else if (primaryAdmin && !root.accountId) {
      root.accountId = primaryAdmin.id;
      await this.folderRepo.save(root);
    }

    if (primaryAdmin) {
      await this.accountRepo.update(primaryAdmin.id, { rootFolderId: ROOT_FOLDER_ID });
      await this.folderRepo
        .createQueryBuilder()
        .update(Folder)
        .set({ accountId: primaryAdmin.id })
        .where('accountId IS NULL')
        .execute();
    }

    await this.refreshPlatformTelegramMergeDefaults();
  }

  /** Admin đầu tiên được tạo — backup MySQL gắn tenant admin này, v.v. */
  async findPrimaryAdmin(): Promise<Account | null> {
    return this.accountRepo.findOne({
      where: { role: AccountRole.ADMIN },
      order: { createdAt: 'ASC' },
    });
  }

  async countAccounts(): Promise<number> {
    return this.accountRepo.count();
  }

  async findByUsername(username: string): Promise<Account | null> {
    const u = username.trim();
    if (!u) return null;
    return this.accountRepo.findOne({ where: { username: u } });
  }

  /** Webhook đồng bộ ngược: khớp chat trên account hoặc chat chung trong Cài đặt server → admin đầu tiên. */
  async findByTelegramStorageChatId(chatId: string): Promise<Account | null> {
    const c = chatId.trim();
    if (!c) return null;
    const direct = await this.accountRepo.findOne({
      where: { telegramStorageChatId: c },
    });
    if (direct) {
      return direct;
    }
    const shared = (
      this.runtime.effectiveTrimmed(EnvKey.TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID) ?? ''
    ).trim();
    if (shared === c) {
      return this.findPrimaryAdmin();
    }
    return null;
  }

  async findById(id: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { id } });
  }

  async listAccounts(): Promise<Account[]> {
    return this.accountRepo.find({ order: { createdAt: 'ASC' } });
  }

  async registerUser(input: RegisterAccountInput): Promise<Account> {
    const username = input.username.trim();
    const password = input.password;
    if (!username || username.length < 2) {
      throw new BadRequestException('username không hợp lệ');
    }
    if (!password || password.length < 6) {
      throw new BadRequestException('password tối thiểu 6 ký tự');
    }

    const saved = await this.accountRepo.manager.transaction(async (manager) => {
      const accountRepo = manager.getRepository(Account);
      const folderRepo = manager.getRepository(Folder);

      const isFirstAccount = (await accountRepo.count()) === 0;

      const exists = await accountRepo.exist({ where: { username } });
      if (exists) {
        throw new ConflictException('Username đã tồn tại');
      }

      const usePlatform = input.usePlatformTelegramStorage !== false;
      let telegramBotToken: string | null;
      let telegramStorageChatId: string | null;
      let telegramUsePlatformDefaults: boolean;

      if (isFirstAccount) {
        const merge = this.getPlatformTelegramMergeDefaultsSync();
        const token = (input.telegramBotToken ?? '').trim();
        const chatId = (input.telegramStorageChatId ?? '').trim();

        if (usePlatform && merge) {
          telegramBotToken = null;
          telegramStorageChatId = null;
          telegramUsePlatformDefaults = true;
        } else if (token && chatId) {
          telegramBotToken = token;
          telegramStorageChatId = chatId;
          telegramUsePlatformDefaults = false;
        } else if (!token && !chatId) {
          telegramBotToken = null;
          telegramStorageChatId = null;
          telegramUsePlatformDefaults = false;
        } else {
          throw new BadRequestException(
            'Cần đủ bot token và chat ID, hoặc để trống cả hai để cấu hình sau trong Cài đặt.',
          );
        }

        const accountDraft = accountRepo.create({
          username,
          passwordHash: hashPassword(password),
          role: AccountRole.ADMIN,
          minioLimitGb: UploadDefaults.BOOTSTRAP_ADMIN_MINIO_GB,
          telegramBotToken,
          telegramStorageChatId,
          telegramAlertChatId: null,
          telegramUsePlatformDefaults,
          rootFolderId: ROOT_FOLDER_ID,
        });
        const acc = await accountRepo.save(accountDraft);

        let root = await folderRepo.findOne({ where: { id: ROOT_FOLDER_ID } });
        if (!root) {
          root = await folderRepo.save(
            folderRepo.create({
              id: ROOT_FOLDER_ID,
              parentId: null,
              name: VIRTUAL_ROOT_FOLDER_NAME,
              accountId: acc.id,
            }),
          );
        } else if (!root.accountId) {
          root.accountId = acc.id;
          await folderRepo.save(root);
        }

        acc.rootFolderId = ROOT_FOLDER_ID;
        await accountRepo.save(acc);

        await folderRepo
          .createQueryBuilder()
          .update(Folder)
          .set({ accountId: acc.id })
          .where('accountId IS NULL')
          .execute();

        return acc;
      }

      let stToken: string | null;
      let stChat: string | null;
      let stPlatform: boolean;
      if (usePlatform) {
        if (!this.getPlatformTelegramMergeDefaultsSync()) {
          throw new BadRequestException(
            'Chưa cấu đủ bot token (admin đầu tiên) và chat lưu chung (TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID trong Cài đặt server hoặc chat trên tài khoản đó) — không thể đăng ký chế độ dùng chung.',
          );
        }
        stToken = null;
        stChat = null;
        stPlatform = true;
      } else {
        const token = (input.telegramBotToken ?? '').trim();
        const chatId = (input.telegramStorageChatId ?? '').trim();
        if (!token || !chatId) {
          throw new BadRequestException('Thiếu Telegram bot token hoặc chat id');
        }
        stToken = token;
        stChat = chatId;
        stPlatform = false;
      }

      const accountDraft = accountRepo.create({
        username,
        passwordHash: hashPassword(password),
        role: AccountRole.USER,
        minioLimitGb: 0,
        telegramBotToken: stToken,
        telegramStorageChatId: stChat,
        telegramUsePlatformDefaults: stPlatform,
        rootFolderId: ROOT_FOLDER_ID,
      });
      const acc = await accountRepo.save(accountDraft);

      const userRoot = await folderRepo.save(
        folderRepo.create({
          parentId: null,
          name: VIRTUAL_ROOT_FOLDER_NAME,
          accountId: acc.id,
        }),
      );
      acc.rootFolderId = userRoot.id;
      await accountRepo.save(acc);
      return acc;
    });

    await this.refreshPlatformTelegramMergeDefaults();
    return saved;
  }

  async createAccountByAdmin(input: CreateAccountAdminInput): Promise<Account> {
    const username = input.username.trim();
    if (!username || username.length < 2) {
      throw new BadRequestException('username không hợp lệ');
    }
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException('password tối thiểu 6 ký tự');
    }
    const exists = await this.accountRepo.exist({ where: { username } });
    if (exists) {
      throw new ConflictException('Username đã tồn tại');
    }
    const minioLimitGb =
      Number.isFinite(input.minioLimitGb) && input.minioLimitGb >= 0 ? input.minioLimitGb : 0;

    const usePlatform = Boolean(input.telegramUsePlatformDefaults);
    let telegramBotToken: string | null;
    let telegramStorageChatId: string | null;
    let telegramUsePlatformDefaults: boolean;
    if (usePlatform) {
      if (!this.getPlatformTelegramMergeDefaultsSync()) {
        throw new BadRequestException(
          'Chưa đủ bot token (admin đầu tiên) và chat lưu chung (TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID hoặc chat trên tài khoản đó) — không thể tạo user chế độ dùng chung.',
        );
      }
      telegramBotToken = null;
      telegramStorageChatId = null;
      telegramUsePlatformDefaults = true;
    } else {
      telegramBotToken = input.telegramBotToken?.trim() || null;
      telegramStorageChatId = input.telegramStorageChatId?.trim() || null;
      telegramUsePlatformDefaults = false;
    }

    const accountDraft = this.accountRepo.create({
      username,
      passwordHash: hashPassword(input.password),
      role: input.role,
      minioLimitGb,
      telegramBotToken,
      telegramStorageChatId,
      telegramUsePlatformDefaults,
      rootFolderId: ROOT_FOLDER_ID,
    });
    const saved = await this.accountRepo.save(accountDraft);

    const root = await this.folderRepo.save(
      this.folderRepo.create({
        parentId: null,
        name: VIRTUAL_ROOT_FOLDER_NAME,
        accountId: saved.id,
      }),
    );
    saved.rootFolderId = root.id;
    await this.accountRepo.save(saved);
    await this.refreshPlatformTelegramMergeDefaults();
    return saved;
  }

  async updateAccountQuota(accountId: string, minioLimitGb: number): Promise<Account> {
    const acc = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!acc) {
      throw new NotFoundException('Không tìm thấy account');
    }
    const gb = Number(minioLimitGb);
    if (!Number.isFinite(gb) || gb < 0) {
      throw new BadRequestException('minioLimitGb không hợp lệ');
    }
    acc.minioLimitGb = gb;
    return this.accountRepo.save(acc);
  }

  async patchSelfTelegram(
    accountId: string,
    input: {
      usePlatformTelegramStorage: boolean;
      telegramBotToken?: string;
      telegramStorageChatId?: string;
    },
  ): Promise<Account> {
    const acc = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!acc) {
      throw new NotFoundException('Không tìm thấy account');
    }
    const primary = await this.findPrimaryAdmin();
    const usePlatform = input.usePlatformTelegramStorage !== false;
    if (primary?.id === acc.id && usePlatform) {
      throw new BadRequestException(
        'Admin đầu tiên không được bật “dùng chung”: bot token (và chat lưu trên đây hoặc TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID trong Cài đặt server) là mặc định cho các user khác.',
      );
    }
    if (usePlatform) {
      if (!this.getPlatformTelegramMergeDefaultsSync()) {
        throw new BadRequestException(
          'Chưa đủ bot token (admin đầu tiên) và chat lưu chung (TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID hoặc chat trên tài khoản đó) — chưa thể bật chế độ chung.',
        );
      }
      acc.telegramBotToken = null;
      acc.telegramStorageChatId = null;
      acc.telegramUsePlatformDefaults = true;
    } else {
      const newChat = (input.telegramStorageChatId ?? '').trim();
      const newToken = (input.telegramBotToken ?? '').trim();
      const existingChat = (acc.telegramStorageChatId ?? '').trim();
      const existingToken = (acc.telegramBotToken ?? '').trim();
      const token = newToken || existingToken;
      const sharedChat = (
      this.runtime.effectiveTrimmed(EnvKey.TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID) ?? ''
    ).trim();
      const isPrimarySelf = primary?.id === acc.id;

      if (!token) {
        throw new BadRequestException(
          'Cần bot token — hoặc để trống để giữ token đã lưu.',
        );
      }

      if (isPrimarySelf) {
        const effectiveChat = newChat || existingChat;
        if (!effectiveChat && !sharedChat) {
          throw new BadRequestException(
            'Nhập chat ID lưu file hoặc cấu hình TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID trong Cài đặt server.',
          );
        }
        acc.telegramBotToken = token;
        acc.telegramStorageChatId = effectiveChat || null;
      } else {
        const chatId = newChat || existingChat;
        if (!chatId) {
          throw new BadRequestException(
            'Cần chat ID khi dùng Telegram riêng — hoặc để trống để giữ giá trị đã lưu.',
          );
        }
        acc.telegramBotToken = token;
        acc.telegramStorageChatId = chatId;
      }
      acc.telegramUsePlatformDefaults = false;
    }
    const saved = await this.accountRepo.save(acc);
    await this.refreshPlatformTelegramMergeDefaults();
    return saved;
  }

  async updateAccountTelegram(
    accountId: string,
    telegramBotToken: string | null,
    telegramStorageChatId: string | null,
  ): Promise<Account> {
    const acc = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!acc) {
      throw new NotFoundException('Không tìm thấy account');
    }
    acc.telegramBotToken = telegramBotToken?.trim() || null;
    acc.telegramStorageChatId = telegramStorageChatId?.trim() || null;
    acc.telegramUsePlatformDefaults = false;
    const saved = await this.accountRepo.save(acc);
    await this.refreshPlatformTelegramMergeDefaults();
    return saved;
  }

  async setPassword(accountId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('password tối thiểu 6 ký tự');
    }
    const acc = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!acc) {
      throw new NotFoundException('Không tìm thấy account');
    }
    acc.passwordHash = hashPassword(newPassword);
    await this.accountRepo.save(acc);
  }
}
