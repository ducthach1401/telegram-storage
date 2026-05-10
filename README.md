# Telegram Storage

Backend **NestJS** lưu file qua **Telegram Bot API** (Grammy): thư mục kiểu drive, thumbnail ảnh, stream xem/tải. Metadata trên **MySQL** (TypeORM). Upload async bulk qua **Redis + BullMQ**.

## Stack

- **NestJS 10**, **TypeORM**, **MySQL 8.4**, **Grammy**
- **Redis 7**, **BullMQ** — queue upload `POST …/files/upload/async`
- **Sharp** — thumbnail JPEG khi upload ảnh
- **Swagger** — OpenAPI tại `/api/documentation`
- **Docker** — `docker-compose.dev.yml` (dev) & `docker-compose.yml` (prod, PM2 `pm2-runtime`)
- **`@nestjs/schedule`** — backup MySQL định kỳ → file `.sql.gz` đưa lên **kênh lưu Telegram của tài khoản admin đầu tiên** (Cài đặt → Kết nối Telegram), thư mục ảo (mặc định `backup`) — tuỳ chọn `MYSQL_BACKUP_ENABLED=true`

Compose đặt **giới hạn CPU/RAM** cứng trong file YAML (`deploy.resources.limits`). MySQL **không publish cổng** ra host; Redis **không publish** cổng (chỉ network nội bộ).

## Yêu cầu

- **Node.js 22**
- **Docker & Docker Compose** (nếu chạy bằng compose)

## Cấu hình

Sao chép `.env.example` → `.env` và chỉnh giá trị thật (MySQL, Redis, MinIO, …). **Bot token** của admin đầu tiên nhập trong **Cài đặt → Kết nối Telegram**. **Chat lưu chung** (cho user “dùng chung” và tin backup…) đặt trong **Cài đặt server** (`TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID`, chỉ `app_settings`/UI — không env) — để trống thì dùng chat đã lưu trên admin đầu tiên. **`TELEGRAM_ALERT_CHAT_ID`** và các tuỳ chọn khác (`PUBLIC_APP_URL`, ZIP, backup…) trong **Cài đặt server** / `PATCH /api/v1/admin/settings` → `app_settings`. **Basic Auth** dùng user/password trong DB (`accounts`): **không** tự tạo admin — **tài khoản đầu** đăng ký qua `POST /api/v1/auth/register` hoặc `/register.html` trở thành admin (có thể để trống Telegram rồi cấu hình trong Cài đặt).

| Biến | Ý nghĩa |
|------|---------|
| `COMPOSE_PROJECT_NAME` | Tên project Compose (tùy chọn) |
| `APP_PORT` | Cổng HTTP API |
| `SERVICE_NAME` | Chuỗi `GET /api/v1` |
| `DOWNLOAD_SHARE_SECRET` | **Bắt buộc**, ≥16 ký tự — ký token link tải chia sẻ |
| `PUBLIC_APP_URL` | Tuỳ chọn — URL gốc (không `/` cuối) để API share trả `downloadUrl` / `viewUrl` đầy đủ (có thể chỉnh lại trong Cài đặt admin — DB ghi đè env) |
| `TELEGRAM_WEBHOOK_SECRET` | Tuỳ chọn — **chỉ env**: nếu set, webhook phải gửi header `X-Telegram-Bot-Api-Secret-Token` trùng giá trị (khớp khi `setWebhook`) |
| `TELEGRAM_SYNC_FOLDER_ID` | Tuỳ chọn — `root` hoặc UUID thư mục đích cho document đồng bộ ngược; để trống = root |
| `MINIO_ENDPOINT`, `MINIO_REGION`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | Cấu hình MinIO/S3 cho file lớn |
| `FOLDER_ZIP_MAX_FILES` | Tuỳ chọn — tối đa số file trong một lần ZIP (sync hoặc queue); mặc định 2000 trong code, trần 50000 |
| `FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS` | TTL token tải ZIP async (60–604800; mặc định 3600) |
| `SHARE_RATE_LIMIT_TTL_MS`, `SHARE_RATE_LIMIT_MAX` | Cửa sổ và số request tối đa cho `/shared/files*` và `/folders/download/stream` |
| `REDIS_HOST`, `REDIS_PORT` | Redis queue — trong Compose: `redis` / `6379` (Redis không bật AUTH trong stack mặc định) |
| `MYSQL_*` | `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`. Official image MySQL **vẫn** cần mật khẩu `root` lần đầu tạo volume — trong Compose đặt bằng `${MYSQL_PASSWORD}` (không cần biến `MYSQL_ROOT_PASSWORD` trong `.env`; root và user app **cùng** giá trị mật khẩu). Volume đã tồn tại: đổi `MYSQL_PASSWORD` trong `.env` **không** đổi mật khẩu root/MySQL đã lưu — cần `ALTER USER` hoặc tạo volume mới |
| `MYSQL_BACKUP_ENABLED` | `true` — chạy cron `mysqldump` + lưu `.sql.gz` như file drive trên **kênh lưu của admin đầu tiên** (cột `telegramStorageChatId` trên account đó) |
| `MYSQL_BACKUP_CRON` | Cron (vd `0 3 * * 0` = Chủ nhật 03:00 theo giờ máy chạy app). Mặc định trong code nếu không set |
| `MYSQL_BACKUP_FOLDER_NAME` | Tuỳ chọn — tên thư mục con dưới **root** chứa các file backup (mặc định `backup` trong code nếu không set) |
| `MYSQL_IMPORT_MAX_MB` | Tuỳ chọn — giới hạn kích thước dump upload qua `POST …/admin/mysql/import` (mặc định 512 trong code) |
| `TYPEORM_SYNCHRONIZE` | `true` / `false` — prod nên `false` khi có migration |

**Telegram — lưu file / webhook:** **bot token** của admin đầu tiên trong **`accounts`** (Cài đặt → Kết nối Telegram). **Chat lưu chung** cho user không có bot/chat riêng: **`TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID`** trong **`app_settings`** (không đọc env) — **ưu tiên** trên `telegramStorageChatId` trên admin đầu tiên khi merge và webhook gửi file. **`TELEGRAM_ALERT_CHAT_ID`** (tin cảnh báo) chỉ trong **`app_settings`**.

Tuỳ chọn (mặc định trong code): `UPLOAD_TMP_DIR`, `UPLOAD_QUEUE_CONCURRENCY` (ZIP async: `UPLOAD_TMP_DIR/folder-zip/`; backup SQL tạm: `UPLOAD_TMP_DIR/mysql-backup/`; import SQL API: `UPLOAD_TMP_DIR/mysql-import/`).

MySQL chỉ trong network Compose (`MYSQL_HOST=mysql`). Redis chỉ internal (`REDIS_HOST=redis`).

## Chạy local (không Docker)

```bash
npm install
cp .env.example .env
npm run start:dev
```

Cần Redis & MySQL sẵn có và khớp biến `REDIS_*`, `MYSQL_*`.

Build prod cục bộ:

```bash
npm run build && npm run start:prod
```

## Docker — development

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Docker — production

```bash
docker compose up --build -d
```

## API & Swagger

- **Swagger UI:** `http://localhost:<APP_PORT>/api/documentation`
- **OpenAPI JSON:** `…/api/documentation/swagger.json`

Prefix **`api/v1`** trong `src/common/api-route.ts` (không dùng `setGlobalPrefix` global).

### Endpoints chính

| Phương thức | Đường dẫn | Ghi chú |
|-------------|-----------|---------|
| `GET` | `/api/v1` | Tên service (plain text) |
| `POST` | `/api/v1/folders` | Tạo thư mục |
| `POST` | `/api/v1/folders/:folderId/copy` | Sao chép đệ quy (metadata trỏ cùng tin Telegram); body `{ "parentId"?: "root" \| uuid }` |
| `GET` | `/api/v1/folders/:folderId/download` | ZIP đệ quy sync stream |
| `POST` | `/api/v1/folders/:folderId/download/async` | Enqueue ZIP queue → `GET …/folders/download/jobs/:jobId` → token → `GET …/folders/download/stream?token=` (**public**) |
| `GET` | `/api/v1/folders/download/jobs/:jobId` | Trạng thái job ZIP async |
| `GET` | `/api/v1/folders/download/stream?token=…` | Tải ZIP khi job xong — **không** Basic Auth |
| `GET` | `/api/v1/folders/:folderId/contents` | `folderId` = `root` hoặc UUID. Query tuỳ chọn `folderLimit`, `folderCursor` phân trang thư mục con; `fileLimit`, `fileCursor` phân trang file (độc lập) |
| `DELETE` | `/api/v1/folders/:folderId` | UUID — không xóa gốc |
| `GET` | `/api/v1/files/search` | `q`, tuỳ chọn `folderId`, `mode`, `limit` |
| `POST` | `/api/v1/files/meta/batch` | Body `{ "ids": ["uuid", …] }` tối đa 100 — metadata các file tìm được |
| `POST` | `/api/v1/files/upload` | Multipart `file`; query `duplicatePolicy` hoặc `overwrite=true` |
| `POST` | `/api/v1/files/upload/async` | Queue Redis — query giống upload đồng bộ |
| `GET` | `/api/v1/files/upload/jobs/:jobId` | Trạng thái job async |
| `POST` | `/api/v1/files/:id/share-download` | Body tuỳ chọn `{ "ttlSeconds": 86400 }` (60–604800) — trả token + đường dẫn/URL công khai |
| `PATCH` | `/api/v1/files/:id` | Đổi tên / di chuyển — chỉ DB; query `duplicatePolicy` |
| `DELETE` | `/api/v1/files/:id` | Xóa DB + best-effort Telegram (`204`) |
| `GET` | `/api/v1/files/:id` | Metadata |
| `GET` | `/api/v1/files/:id/view` | Xem inline |
| `GET` | `/api/v1/files/:id/download` | Tải attachment |
| `GET` | `/api/v1/files/:id/thumbnail` | Thumbnail JPEG (nếu có) |
| `GET` | `/api/v1/shared/files/download?token=…` | Tải file — **không** Basic Auth |
| `GET` | `/api/v1/shared/files/view?token=…` | Xem inline — **không** Basic Auth |
| `GET` | `/api/v1/admin/queue/stats` \| `/jobs` \| `/workers` | BullMQ |
| `POST` | `/api/v1/admin/reconcile/files` | Body JSON reconcile Telegram ↔ DB |
| `GET` | `/api/v1/admin/files/duplicates` | Nhóm bản ghi trùng `telegram_file_unique_id` |
| `POST` | `/api/v1/admin/mysql/import` | Multipart `file` — `.sql` hoặc `.sql.gz`; pipe vào DB `MYSQL_DATABASE` (**Basic Auth**; có thể ghi đè/xóa dữ liệu tùy dump) |
| `POST` | `/api/v1/telegram/webhook` | BotFather `setWebhook` — đồng bộ document vào DB khi chat khớp **kênh lưu** đã cấu hình trong Cài đặt admin (**public**; tuỳ chọn header secret) |

**Upload — trùng tên:** query `duplicatePolicy=reject|overwrite|suffix` hoặc `overwrite=true`. **PATCH file** dùng cùng ý nghĩa khi đụng tên trong thư mục đích.

### Basic Auth

Global guard: **Basic Auth** cho hầu hết route (hai biến env không được để trống). Swagger nút **Authorize** (`basic-auth`). **`GET /api/v1/shared/files/*`** và **`GET /api/v1/folders/download/stream`** và **`POST /api/v1/telegram/webhook`** là **public** (`@Public()`). Link share chịu **rate limit** (`SHARE_RATE_LIMIT_TTL_MS`, `SHARE_RATE_LIMIT_MAX`). `OPTIONS` không chặn (CORS).

## Cấu trúc `src/`

- `app/` — module gốc
- `backup/` — lịch backup MySQL → Telegram
- `auth/` — Basic Auth guard, rate limit route share (`share-throttler.guard.ts`)
- `common/` — env keys, HTTP helpers, API messages, `api-route.ts`
- `storage/domain/` — entities, DTO, policy/cursor
- `storage/telegram/` — Telegram Bot API
- `storage/folder/`, `storage/file/` — REST
- `storage/admin/` — queue + reconcile + import MySQL
- `storage/queue/` — BullMQ processor & constants
- `storage/storage.service.ts`, `storage.module.ts`
- `swagger.setup.ts`

## Giới hạn & lưu ý

- **Đồng bộ ngược Telegram:** `POST /api/v1/telegram/webhook` — nên đặt `TELEGRAM_WEBHOOK_SECRET` (env) và cấu hình cùng secret khi `setWebhook`. File lưu vào `TELEGRAM_SYNC_FOLDER_ID` (Cài đặt admin / env) hoặc root nếu để trống. Tin không có `document` hoặc không khớp account theo chat ID đã lưu trong DB thì bỏ qua (trả `200` không xử lý).
- **ZIP async:** file ZIP nằm dưới `UPLOAD_TMP_DIR/folder-zip/`; token tải ký bằng `DOWNLOAD_SHARE_SECRET`, TTL `FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS`.
- **Backup MySQL:** dump được đưa vào **cùng kênh lưu file của admin đầu tiên** và một **thư mục ảo** dưới root (`MYSQL_BACKUP_FOLDER_NAME`, mặc định `backup`), có metadata trong DB như upload thường. Image production có `mysqldump` (Alpine `mariadb-client`). Dev `docker-compose.dev.yml` (`node:22-alpine`) **không** có sẵn — cài `mariadb-client` hoặc `MYSQL_BACKUP_ENABLED=false`. File `.sql.gz` **≤ ~49MB** (Telegram ~50MB); vượt chỉ gửi cảnh báo text qua **`TELEGRAM_ALERT_CHAT_ID`** trong Cài đặt server (nếu có).
- **Import MySQL qua API:** `POST /api/v1/admin/mysql/import` dùng lệnh `mysql` (cùng `mariadb-client` như backup). Dev image không có CLI thì endpoint thất bại với thông báo thiếu `mysql`; giới hạn kích thước `MYSQL_IMPORT_MAX_MB`.
- **Copy thư mục:** nhiều bản ghi có thể trỏ cùng `telegram_message_id` — xóa một bản chỉ gọi `deleteMessage` khi không còn bản ghi nào khác trỏ tin đó (reconcile dùng `deleteFile` nên cùng logic).
- **Cảnh báo Telegram:** chỉ bật khi cấu hình chat cảnh báo trong **Cài đặt admin** (`TELEGRAM_ALERT_CHAT_ID` trong `app_settings`). Chỉ gửi cho lỗi **HTTP ≥500** (và mọi lỗi không bắt được như 500); lỗi 4xx (validation, 404, auth…) **không** gửi để tránh spam. Upload async thất bại **sau khi hết retry** cũng được gửi một tin.
- File `<20MB` lưu Telegram; file `20–50MB` lưu MinIO và backup Telegram; file `>50MB` chỉ lưu MinIO. **Quota MinIO** chỉ theo **từng tài khoản** (`minioLimitGb` trong DB / chỉnh trong Admin); không có trần MinIO toàn server.
- Upload async cần Redis ổn định; job retry/backoff do BullMQ cấu hình trong `storage.module.ts`.
- `telegramMessageId` cần để xóa tin trên Telegram; bản ghi cũ thiếu cột có thể chỉ xóa DB.
- Prod: `TYPEORM_SYNCHRONIZE=false` + migration khi schema ổn định.

## Giấy phép

Private (`package.json`: `"private": true`).
