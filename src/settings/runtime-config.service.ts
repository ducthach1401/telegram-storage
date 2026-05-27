import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvKey } from '../common/env-keys';
import { ROOT_FOLDER_ALIAS } from '../storage/domain/constants';
import { UploadDefaults } from '../common/upload.defaults';
import { AppSetting } from './app-setting.entity';
import {
  ADMIN_PATCHABLE_KEYS,
  ADMIN_PATCHABLE_KEY_SET,
  ADMIN_READONLY_QUEUE_KEYS,
  TELEGRAM_DB_ONLY_KEYS,
  type AdminPatchableKey,
} from './managed-settings.constants';
import type { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';

@Injectable()
export class RuntimeConfigService implements OnModuleInit {
  private readonly log = new Logger(RuntimeConfigService.name);
  private overrides = new Map<string, string>();
  private readonly telegramDbOnly = new Set<string>(TELEGRAM_DB_ONLY_KEYS);

  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reloadOverrides();
    await this.migrateLegacyTelegramStorageChatKey();
    await this.reloadOverrides();
    await this.ensureAllPatchableSettingsSeeded();
    await this.reloadOverrides();
  }

  /** Đổi tên khóa cũ `TELEGRAM_STORAGE_CHAT_ID` → `TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID` trong DB. */
  private async migrateLegacyTelegramStorageChatKey(): Promise<void> {
    const LEGACY = 'TELEGRAM_STORAGE_CHAT_ID';
    const next = EnvKey.TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID;
    const legacyRow = await this.repo.findOne({ where: { key: LEGACY } });
    if (!legacyRow) {
      return;
    }
    const hasNext = await this.repo.exist({ where: { key: next } });
    if (!hasNext) {
      await this.repo.save(this.repo.create({ key: next, value: legacyRow.value }));
      this.log.log(`Đã chuyển ${LEGACY} → ${next} trong app_settings.`);
    }
    await this.repo.delete({ key: LEGACY });
  }

  /**
   * Lần đầu chạy (hoặc sau khi xóa tay): tạo đủ dòng `app_settings` cho mọi khóa Cài đặt server.
   * Giá trị lấy từ env / `.env` (lần đầu thiếu trong DB) — không ghi đè dòng đã có.
   */
  private async ensureAllPatchableSettingsSeeded(): Promise<void> {
    let inserted = 0;
    for (const key of ADMIN_PATCHABLE_KEYS) {
      if (this.overrides.has(key)) {
        continue;
      }
      const value = this.patchableStoredValue(key, { allowEnv: true });
      await this.repo.save(this.repo.create({ key, value }));
      inserted += 1;
    }
    if (inserted > 0) {
      this.log.log(
        `Đã khởi tạo ${inserted} khóa trong app_settings (thiếu trong DB).`,
      );
    }
  }

  /**
   * Giá trị cho khóa Cài đặt server.
   * `allowEnv: true` — lúc seed DB lần đầu (đọc env / `.env`).
   * `allowEnv: false` — lúc đọc hiệu lực mà chưa có dòng DB: chỉ default code + `APP_PORT`, không env.
   */
  private patchableStoredValue(
    key: AdminPatchableKey,
    opts: { allowEnv: boolean },
  ): string {
    const { allowEnv } = opts;
    const get = (k: string) => (allowEnv ? this.config.get<string>(k) : undefined);
    const trim = (v: string | undefined) => (v ?? '').trim();

    switch (key) {
      case EnvKey.PUBLIC_APP_URL: {
        const fromEnv = allowEnv ? trim(get(EnvKey.PUBLIC_APP_URL)) : '';
        if (fromEnv) {
          return fromEnv;
        }
        const port = trim(this.config.get<string>(EnvKey.APP_PORT)) || '3000';
        return `http://localhost:${port}`;
      }
      case EnvKey.TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID:
        return '';
      case EnvKey.TELEGRAM_ALERT_CHAT_ID:
        return allowEnv ? trim(get(EnvKey.TELEGRAM_ALERT_CHAT_ID)) : '';
      case EnvKey.TELEGRAM_SYNC_FOLDER_ID: {
        const fromEnv = allowEnv ? trim(get(EnvKey.TELEGRAM_SYNC_FOLDER_ID)) : '';
        return fromEnv || ROOT_FOLDER_ALIAS;
      }
      case EnvKey.UPLOAD_QUEUE_CONCURRENCY: {
        const n = Number(
          (allowEnv ? get(EnvKey.UPLOAD_QUEUE_CONCURRENCY) : undefined) ??
            String(UploadDefaults.QUEUE_CONCURRENCY_FALLBACK),
        );
        return String(
          Math.max(
            1,
            Number.isFinite(n) ? Math.floor(n) : UploadDefaults.QUEUE_CONCURRENCY_FALLBACK,
          ),
        );
      }
      case EnvKey.UPLOAD_QUEUE_ATTEMPTS: {
        const n = Number(
          (allowEnv ? get(EnvKey.UPLOAD_QUEUE_ATTEMPTS) : undefined) ??
            String(UploadDefaults.QUEUE_ATTEMPTS_FALLBACK),
        );
        return String(
          Math.max(
            1,
            Number.isFinite(n) ? Math.floor(n) : UploadDefaults.QUEUE_ATTEMPTS_FALLBACK,
          ),
        );
      }
      case EnvKey.UPLOAD_QUEUE_BACKOFF_MS: {
        const n = Number(
          (allowEnv ? get(EnvKey.UPLOAD_QUEUE_BACKOFF_MS) : undefined) ??
            String(UploadDefaults.QUEUE_BACKOFF_MS_FALLBACK),
        );
        return String(
          Math.max(
            1000,
            Number.isFinite(n) ? Math.floor(n) : UploadDefaults.QUEUE_BACKOFF_MS_FALLBACK,
          ),
        );
      }
      case EnvKey.SHARE_RATE_LIMIT_TTL_MS: {
        const n = Number(
          (allowEnv ? get(EnvKey.SHARE_RATE_LIMIT_TTL_MS) : undefined) ?? '60000',
        );
        return String(Math.max(1000, Number.isFinite(n) ? n : 60000));
      }
      case EnvKey.SHARE_RATE_LIMIT_MAX: {
        const n = Number((allowEnv ? get(EnvKey.SHARE_RATE_LIMIT_MAX) : undefined) ?? '60');
        return String(Math.max(1, Number.isFinite(n) ? n : 60));
      }
      case EnvKey.FOLDER_ZIP_MAX_FILES: {
        const raw = allowEnv ? trim(get(EnvKey.FOLDER_ZIP_MAX_FILES)) : '';
        if (!raw) {
          return '2000';
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 1) {
          return '2000';
        }
        return String(Math.min(Math.floor(n), 50000));
      }
      case EnvKey.FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS: {
        const raw = allowEnv ? trim(get(EnvKey.FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS)) : '';
        const n = raw !== '' ? Number(raw) : 3600;
        const ttl = Math.min(Math.max(Number.isFinite(n) ? n : 3600, 60), 604800);
        return String(ttl);
      }
      case EnvKey.TELEGRAM_DOWNLOAD_MAX_MB: {
        const mb = Number(
          (allowEnv ? get(EnvKey.TELEGRAM_DOWNLOAD_MAX_MB) : undefined) ??
            String(UploadDefaults.TELEGRAM_DOWNLOAD_MAX_MB_FALLBACK),
        );
        const safe = Number.isFinite(mb)
          ? mb
          : UploadDefaults.TELEGRAM_DOWNLOAD_MAX_MB_FALLBACK;
        return String(Math.max(1, Math.floor(safe)));
      }
      case EnvKey.MYSQL_IMPORT_MAX_MB: {
        const mb = Number((allowEnv ? get(EnvKey.MYSQL_IMPORT_MAX_MB) : undefined) ?? '512');
        const safe = Number.isFinite(mb) && mb > 0 ? mb : 512;
        return String(Math.floor(safe));
      }
      case EnvKey.MYSQL_BACKUP_ENABLED:
        return allowEnv && trim(get(EnvKey.MYSQL_BACKUP_ENABLED)) === 'true'
          ? 'true'
          : 'false';
      case EnvKey.MYSQL_BACKUP_CRON:
        return (allowEnv ? trim(get(EnvKey.MYSQL_BACKUP_CRON)) : '') || '0 3 * * 0';
      case EnvKey.MYSQL_BACKUP_FOLDER_NAME:
        return (allowEnv ? trim(get(EnvKey.MYSQL_BACKUP_FOLDER_NAME)) : '') || 'backup';
      default: {
        const _exhaustive: never = key;
        return _exhaustive;
      }
    }
  }

  async reloadOverrides(): Promise<void> {
    const rows = await this.repo.find();
    this.overrides = new Map(rows.map((r) => [r.key, r.value]));
  }

  /**
   * Raw hiệu lực: với khóa Cài đặt server (`ADMIN_PATCHABLE_KEYS`), có dòng `app_settings` thì chỉ DB
   * (kể cả chuỗi rỗng); thiếu dòng thì default trong code — không đọc env cho các khóa đó.
   */
  effectiveRaw(key: string): string | undefined {
    if (this.telegramDbOnly.has(key)) {
      return this.overrides.has(key) ? this.overrides.get(key) : undefined;
    }
    if (ADMIN_PATCHABLE_KEY_SET.has(key)) {
      if (this.overrides.has(key)) {
        return this.overrides.get(key);
      }
      return this.patchableStoredValue(key as AdminPatchableKey, { allowEnv: false });
    }
    if (this.overrides.has(key)) {
      return this.overrides.get(key);
    }
    return this.config.get<string>(key);
  }

  effectiveTrimmed(key: string): string | undefined {
    const v = this.effectiveRaw(key);
    if (v === undefined) {
      return undefined;
    }
    return v.trim();
  }

  shareRateLimitTtlMs(): number {
    const n = Number(
      this.effectiveRaw(EnvKey.SHARE_RATE_LIMIT_TTL_MS) ?? '60000',
    );
    return Math.max(1000, Number.isFinite(n) ? n : 60000);
  }

  shareRateLimitMax(): number {
    const n = Number(this.effectiveRaw(EnvKey.SHARE_RATE_LIMIT_MAX) ?? '60');
    return Math.max(1, Number.isFinite(n) ? n : 60);
  }

  telegramDownloadMaxBytes(): number {
    const mb = Number(
      this.effectiveRaw(EnvKey.TELEGRAM_DOWNLOAD_MAX_MB) ??
        String(UploadDefaults.TELEGRAM_DOWNLOAD_MAX_MB_FALLBACK),
    );
    const safe = Number.isFinite(mb) ? mb : UploadDefaults.TELEGRAM_DOWNLOAD_MAX_MB_FALLBACK;
    return Math.max(1, Math.floor(safe)) * 1024 * 1024;
  }

  mysqlImportMaxBytes(): number {
    const mb = Number(this.effectiveRaw(EnvKey.MYSQL_IMPORT_MAX_MB) ?? '512');
    const safe = Number.isFinite(mb) && mb > 0 ? mb : 512;
    return Math.floor(safe) * 1024 * 1024;
  }

  overrideKeys(): string[] {
    return [...this.overrides.keys()];
  }

  queueEnvSnapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const k of ADMIN_READONLY_QUEUE_KEYS) {
      const raw = this.effectiveRaw(k);
      const n = Number(raw);
      if (k === EnvKey.UPLOAD_QUEUE_CONCURRENCY) {
        out[k] = Math.max(
          1,
          Number.isFinite(n)
            ? n
            : UploadDefaults.QUEUE_CONCURRENCY_FALLBACK,
        );
      } else if (k === EnvKey.UPLOAD_QUEUE_ATTEMPTS) {
        out[k] = Math.max(
          1,
          Number.isFinite(n)
            ? n
            : UploadDefaults.QUEUE_ATTEMPTS_FALLBACK,
        );
      } else if (k === EnvKey.UPLOAD_QUEUE_BACKOFF_MS) {
        out[k] = Math.max(
          1000,
          Number.isFinite(n)
            ? n
            : UploadDefaults.QUEUE_BACKOFF_MS_FALLBACK,
        );
      }
    }
    return out;
  }

  getAdminEffectivePayload(): Record<string, string | number | boolean> {
    const effective: Record<string, string | number | boolean> = {};
    for (const key of ADMIN_PATCHABLE_KEYS) {
      effective[key] = this.serializeEffectiveForAdmin(key);
    }
    return effective;
  }

  private serializeEffectiveForAdmin(key: AdminPatchableKey): string | number | boolean {
    if (key === EnvKey.UPLOAD_QUEUE_CONCURRENCY) {
      const n = Number(
        this.effectiveRaw(EnvKey.UPLOAD_QUEUE_CONCURRENCY) ??
          String(UploadDefaults.QUEUE_CONCURRENCY_FALLBACK),
      );
      return Math.max(
        1,
        Number.isFinite(n) ? Math.floor(n) : UploadDefaults.QUEUE_CONCURRENCY_FALLBACK,
      );
    }
    if (key === EnvKey.UPLOAD_QUEUE_ATTEMPTS) {
      const n = Number(
        this.effectiveRaw(EnvKey.UPLOAD_QUEUE_ATTEMPTS) ??
          String(UploadDefaults.QUEUE_ATTEMPTS_FALLBACK),
      );
      return Math.max(
        1,
        Number.isFinite(n) ? Math.floor(n) : UploadDefaults.QUEUE_ATTEMPTS_FALLBACK,
      );
    }
    if (key === EnvKey.UPLOAD_QUEUE_BACKOFF_MS) {
      const n = Number(
        this.effectiveRaw(EnvKey.UPLOAD_QUEUE_BACKOFF_MS) ??
          String(UploadDefaults.QUEUE_BACKOFF_MS_FALLBACK),
      );
      return Math.max(
        1000,
        Number.isFinite(n) ? Math.floor(n) : UploadDefaults.QUEUE_BACKOFF_MS_FALLBACK,
      );
    }
    if (key === EnvKey.SHARE_RATE_LIMIT_TTL_MS) {
      return this.shareRateLimitTtlMs();
    }
    if (key === EnvKey.SHARE_RATE_LIMIT_MAX) {
      return this.shareRateLimitMax();
    }
    if (key === EnvKey.TELEGRAM_DOWNLOAD_MAX_MB) {
      return Math.round(this.telegramDownloadMaxBytes() / (1024 * 1024));
    }
    if (key === EnvKey.MYSQL_IMPORT_MAX_MB) {
      return Math.round(this.mysqlImportMaxBytes() / (1024 * 1024));
    }
    if (key === EnvKey.MYSQL_BACKUP_ENABLED) {
      return (
        (this.effectiveTrimmed(EnvKey.MYSQL_BACKUP_ENABLED) ?? 'false') === 'true'
      );
    }
    if (key === EnvKey.FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS) {
      const raw = this.effectiveRaw(key)?.trim();
      const n =
        raw !== undefined && raw !== ''
          ? Number(raw)
          : 3600;
      const ttl = Math.min(Math.max(Number.isFinite(n) ? n : 3600, 60), 604800);
      return ttl;
    }
    if (key === EnvKey.FOLDER_ZIP_MAX_FILES) {
      const raw = this.effectiveRaw(key)?.trim();
      const n = raw !== undefined && raw !== '' ? Number(raw) : NaN;
      if (!Number.isFinite(n) || n < 1) {
        return 2000;
      }
      return Math.min(Math.floor(n), 50000);
    }
    const raw = this.effectiveRaw(key);
    return raw ?? '';
  }

  async persistAdminPatch(dto: UpdateAdminSettingsDto): Promise<void> {
    const entries: Array<[AdminPatchableKey, string | number | null]> = [];
    for (const key of ADMIN_PATCHABLE_KEYS) {
      const prop = key as keyof UpdateAdminSettingsDto;
      if (!(prop in dto) || dto[prop] === undefined) {
        continue;
      }
      entries.push([key, dto[prop] as string | number | null]);
    }

    for (const [key, val] of entries) {
      const envKey = key as AdminPatchableKey;
      if (val === null) {
        await this.repo.delete({ key: envKey });
        this.overrides.delete(envKey);
        continue;
      }
      const str =
        typeof val === 'number'
          ? String(val)
          : typeof val === 'boolean'
            ? val
              ? 'true'
              : 'false'
            : String(val).trim();
      if (envKey === EnvKey.UPLOAD_QUEUE_CONCURRENCY) {
        const n = Number(str);
        if (!Number.isFinite(n) || n < 1) {
          throw new BadRequestException('UPLOAD_QUEUE_CONCURRENCY không hợp lệ');
        }
      }
      if (envKey === EnvKey.UPLOAD_QUEUE_ATTEMPTS) {
        const n = Number(str);
        if (!Number.isFinite(n) || n < 1) {
          throw new BadRequestException('UPLOAD_QUEUE_ATTEMPTS không hợp lệ');
        }
      }
      if (envKey === EnvKey.UPLOAD_QUEUE_BACKOFF_MS) {
        const n = Number(str);
        if (!Number.isFinite(n) || n < 1000) {
          throw new BadRequestException('UPLOAD_QUEUE_BACKOFF_MS không hợp lệ');
        }
      }
      if (
        envKey === EnvKey.MYSQL_BACKUP_CRON &&
        str.length > 0 &&
        !/^[\d\*\-\/,\s]+$/.test(str)
      ) {
        throw new BadRequestException('MYSQL_BACKUP_CRON không hợp lệ');
      }
      await this.repo.save(this.repo.create({ key: envKey, value: str }));
      this.overrides.set(envKey, str);
    }

    this.log.log(`Đã cập nhật ${entries.length} cấu hình runtime`);
  }

  async upsertPatchableSetting(key: AdminPatchableKey, value: string): Promise<void> {
    const str = value.trim();
    await this.repo.save(this.repo.create({ key, value: str }));
    this.overrides.set(key, str);
  }
}
