import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { ApiExceptionMessage } from '../../common/api-messages';
import { EnvKey } from '../../common/env-keys';

@Injectable()
export class MysqlImportService {
  private readonly log = new Logger(MysqlImportService.name);

  constructor(private readonly config: ConfigService) {}

  /** Stream file `.sql` hoặc `.sql.gz` vào `mysql` stdin → DB `MYSQL_DATABASE`. */
  async importFromUploadedDumpPath(absolutePath: string): Promise<void> {
    const host = this.config.getOrThrow<string>(EnvKey.MYSQL_HOST);
    const port = Number(this.config.getOrThrow<string>(EnvKey.MYSQL_PORT));
    const user = this.config.getOrThrow<string>(EnvKey.MYSQL_USER);
    const password = this.config.getOrThrow<string>(EnvKey.MYSQL_PASSWORD);
    const database = this.config.getOrThrow<string>(EnvKey.MYSQL_DATABASE);

    const args = [
      `-h${host}`,
      `-P${String(port)}`,
      `-u${user}`,
      '--protocol=tcp',
      '--default-character-set=utf8mb4',
      database,
    ];

    const mysql = spawn('mysql', args, {
      env: { ...process.env, MYSQL_PWD: password },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    mysql.stderr?.on('data', (b: Buffer) => {
      stderr += b.toString('utf8');
    });

    const exitPromise = new Promise<number>((resolve, reject) => {
      mysql.on('error', (e) => {
        reject(
          e instanceof Error && 'code' in e && e.code === 'ENOENT'
            ? new Error(
                'Không tìm thấy lệnh mysql — cài mariadb-client trong image (Alpine: apk add mariadb-client)',
              )
            : e,
        );
      });
      mysql.on('close', (code) => resolve(code ?? -1));
    });

    const lower = absolutePath.toLowerCase();
    const isGzip = lower.endsWith('.gz');
    const source = isGzip
      ? createReadStream(absolutePath).pipe(createGunzip())
      : createReadStream(absolutePath);

    try {
      await pipeline(source, mysql.stdin);
    } catch (err) {
      mysql.kill('SIGKILL');
      throw err;
    }

    const code = await exitPromise;
    if (code !== 0) {
      this.log.warn(`mysql import exit ${code}: ${stderr.slice(-2000)}`);
      throw new BadRequestException({
        message: ApiExceptionMessage.MYSQL_IMPORT_FAILED,
        exitCode: code,
        stderr: stderr.trim().slice(-8000),
      });
    }

    if (stderr.trim()) {
      this.log.warn(`mysql stderr (cảnh báo?): ${stderr.slice(-1500)}`);
    }
  }
}
