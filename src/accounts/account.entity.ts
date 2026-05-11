import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AccountRole } from './account-role.enum';

@Entity('accounts')
@Unique(['username'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 190 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'enum', enum: AccountRole, default: AccountRole.USER })
  role: AccountRole;

  /** Giới hạn MinIO (GB). User mặc định 0 — chỉ upload dưới 20MB (Telegram-only). */
  @Column({ type: 'double', default: 0 })
  minioLimitGb: number;

  /** false — không đăng nhập / gọi API (admin bật lại trong quản lý tài khoản). */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  telegramBotToken: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  telegramStorageChatId: string | null;

  /** Tuỳ chọn — chat cảnh báo nếu account dùng Telegram riêng (chủ yếu legacy); server gửi alert qua `TELEGRAM_ALERT_CHAT_ID` trong app_settings. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  telegramAlertChatId: string | null;

  /**
   * true — upload dùng bot + kênh từ Cài đặt server (`app_settings`).
   * false — dùng `telegramBotToken` / `telegramStorageChatId` trong DB.
   */
  @Column({ type: 'boolean', default: false })
  telegramUsePlatformDefaults: boolean;

  /** Thư mục gốc ảo của account (folders.id, parentId = null). */
  @Column({ type: 'varchar', length: 36 })
  rootFolderId: string;

  @CreateDateColumn()
  createdAt: Date;
}
