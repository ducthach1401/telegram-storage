/**
 * PM2 — 1 process fork (Telegram + TypeORM không nên cluster).
 * Biến môi trường do Docker / `.env` inject, không ghi đè ở đây.
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'telegram-storage',
      cwd: path.resolve(__dirname),
      script: 'dist/src/main.js',

      instances: 1,
      exec_mode: 'fork',
      watch: false,

      autorestart: true,
      max_memory_restart: '512M',

      /** Tránh restart dồn khi crash ngay sau khi boot */
      min_uptime: 10_000,
      max_restarts: 10,
      restart_delay: 4_000,

      /** Nest `enableShutdownHooks` + đóng DB — chờ đủ trước SIGKILL */
      kill_timeout: 8_000,

      /** Đợi app gửi `ready` sau `listen()` (xem `main.ts`) */
      wait_ready: true,
      listen_timeout: 15_000,

      merge_logs: true,
      time: true,
    },
  ],
};
