import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdir, readFile, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { CronJob } from 'cron';
import { EnvKey } from '../common/env-keys';
import { MimeType } from '../common/http.constants';
import { ROOT_FOLDER_ID } from '../storage/domain/constants';
import { StorageService } from '../storage/storage.service';
import { TelegramService } from '../storage/telegram/telegram.service';

/** Telegram Bot document ~50MB — giữ biên an toàn */
const TELEGRAM_DOC_MAX_BYTES = 49 * 1024 * 1024;

const CRON_JOB_NAME = 'mysql-weekly-backup';

@Injectable()
export class MysqlBackupSchedulerService implements OnModuleInit {
  private readonly log = new Logger(MysqlBackupSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
    private readonly storage: StorageService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.config.get<string>(EnvKey.MYSQL_BACKUP_ENABLED)?.trim() === 'true';
    if (!enabled) {
      this.log.log('MySQL → Telegram backup tắt (MYSQL_BACKUP_ENABLED≠true)');
      return;
    }

    const expr =
      this.config.get<string>(EnvKey.MYSQL_BACKUP_CRON)?.trim() || '0 3 * * 0';

    try {
      this.schedulerRegistry.deleteCronJob(CRON_JOB_NAME);
    } catch {
      /* no previous job */
    }

    const job = new CronJob(expr, () => {
      void this.runBackupJob();
    });
    this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
    job.start();
    this.log.log(
      `Đã bật backup MySQL → kênh lưu (${EnvKey.TELEGRAM_STORAGE_CHAT_ID}) / thư mục ảo, cron: "${expr}"`,
    );
  }

  private backupFolderDisplayName(): string {
    const raw = this.config.get<string>(EnvKey.MYSQL_BACKUP_FOLDER_NAME)?.trim();
    return raw && raw.length > 0 ? raw : 'backup';
  }

  private async runBackupJob(): Promise<void> {
    const host = this.config.getOrThrow<string>(EnvKey.MYSQL_HOST);
    const port = Number(this.config.getOrThrow<string>(EnvKey.MYSQL_PORT));
    const user = this.config.getOrThrow<string>(EnvKey.MYSQL_USER);
    const password = this.config.getOrThrow<string>(EnvKey.MYSQL_PASSWORD);
    const database = this.config.getOrThrow<string>(EnvKey.MYSQL_DATABASE);

    const baseTmp =
      this.config.get<string>(EnvKey.UPLOAD_TMP_DIR)?.trim() ||
      join(process.cwd(), 'tmp', 'uploads');
    const dir = join(baseTmp, 'mysql-backup');
    await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeDb = database.replace(/[^\w.-]/g, '_');
    const fileName = `mysql-backup-${safeDb}-${stamp}.sql.gz`;
    const outPath = join(dir, fileName);

    let stderrLog = '';

    try {
      await this.dumpMysqlToGzip(
        { host, port, user, password, database },
        outPath,
        (chunk) => {
          stderrLog += chunk;
        },
      );

      const st = await stat(outPath);
      if (st.size > TELEGRAM_DOC_MAX_BYTES) {
        await unlink(outPath).catch(() => undefined);
        const msg = `Backup MySQL quá lớn (${st.size} bytes) — Telegram giới hạn ~50MB. Thu nhỏ DB hoặc backup chỉ một phần bảng.`;
        this.log.warn(msg);
        await this.telegram.sendAlertPlainText(msg);
        return;
      }

      const folderLabel = this.backupFolderDisplayName();
      const folderId = await this.storage.ensureNamedChildFolder(
        ROOT_FOLDER_ID,
        folderLabel,
      );
      const buffer = await readFile(outPath);
      await this.storage.persistUploadedDocument(
        folderId,
        fileName,
        MimeType.OCTET_STREAM,
        buffer,
      );
      this.log.log(
        `Đã lưu backup ${fileName} (${st.size} bytes) — kênh lưu file, thư mục ảo "${folderLabel}" (dưới root)`,
      );
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : String(err);
      const tail = stderrLog.trim().slice(-1500);
      const msg = [
        '🚨 Backup MySQL → Telegram thất bại',
        detail,
        tail ? `mysqldump stderr (đuôi):\n${tail}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      this.log.error(msg);
      await this.telegram.sendAlertPlainText(msg);
    } finally {
      await unlink(outPath).catch(() => undefined);
    }
  }

  private async dumpMysqlToGzip(
    opts: {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    },
    outPath: string,
    onStderr: (s: string) => void,
  ): Promise<void> {
    const args = [
      `-h${opts.host}`,
      `-P${String(opts.port)}`,
      `-u${opts.user}`,
      '--single-transaction',
      '--quick',
      '--set-gtid-purged=OFF',
      '--column-statistics=0',
      '--protocol=tcp',
      opts.database,
    ];

    const dump = spawn('mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: opts.password },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    dump.stderr?.on('data', (buf: Buffer) => {
      onStderr(buf.toString('utf8'));
    });

    const gzip = createGzip({ level: 9 });
    const dest = createWriteStream(outPath);

    const pipePromise = pipeline(dump.stdout, gzip, dest);

    const exitPromise = new Promise<number>((resolve, reject) => {
      dump.on('error', (e) => {
        reject(
          e instanceof Error && 'code' in e && e.code === 'ENOENT'
            ? new Error(
                'Không tìm thấy lệnh mysqldump — cài mariadb-client trong image (Alpine: apk add mariadb-client)',
              )
            : e,
        );
      });
      dump.on('close', (code) => resolve(code ?? -1));
    });

    await pipePromise;
    const code = await exitPromise;
    if (code !== 0) {
      throw new Error(`mysqldump thoát với mã ${code}`);
    }
  }
}
