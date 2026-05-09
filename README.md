# Telegram Storage

Backend **NestJS** lưu file qua **Telegram Bot API** (Grammy): thư mục kiểu drive, thumbnail ảnh, stream xem/tải. Metadata trên **MySQL** (TypeORM). Upload async bulk qua **Redis + BullMQ**.

## Stack

- **NestJS 10**, **TypeORM**, **MySQL 8.4**, **Grammy**
- **Redis 7**, **BullMQ** — queue upload `POST …/files/upload/async`
- **Sharp** — thumbnail JPEG khi upload ảnh
- **Swagger** — OpenAPI tại `/api/documentation`
- **Docker** — `docker-compose.dev.yml` (dev) & `docker-compose.yml` (prod, PM2 `pm2-runtime`)

Compose đặt **giới hạn CPU/RAM** cứng trong file YAML (`deploy.resources.limits`). MySQL **không publish cổng** ra host; Redis **không publish** cổng (chỉ network nội bộ).

## Yêu cầu

- **Node.js 22**
- **Docker & Docker Compose** (nếu chạy bằng compose)

## Cấu hình

Sao chép `.env.example` → `.env` và chỉnh giá trị thật (Telegram, MySQL, Basic Auth).

| Biến | Ý nghĩa |
|------|---------|
| `COMPOSE_PROJECT_NAME` | Tên project Compose (tùy chọn) |
| `APP_PORT` | Cổng HTTP API |
| `SERVICE_NAME` | Chuỗi `GET /api/v1` |
| `API_BASIC_AUTH_USER` | **Bắt buộc không rỗng** — user Basic Auth |
| `API_BASIC_AUTH_PASSWORD` | **Bắt buộc không rỗng** — app không bootstrap nếu thiếu |
| `DOWNLOAD_SHARE_SECRET` | **Bắt buộc**, ≥16 ký tự — ký token link tải chia sẻ |
| `PUBLIC_APP_URL` | Tuỳ chọn — URL gốc (không `/` cuối) để API share trả `downloadUrl` / `viewUrl` đầy đủ |
| `TELEGRAM_BOT_TOKEN` | Token BotFather |
| `TELEGRAM_STORAGE_CHAT_ID` | Chat/channel ID lưu file (thường `-100…`) |
| `TELEGRAM_ALERT_CHAT_ID` | Chat/channel nhận **cảnh báo lỗi** (HTTP ≥500, job upload queue fail sau hết retry). Có thể **trùng** `TELEGRAM_STORAGE_CHAT_ID` — cùng kênh lưu file. Để trống = không gửi cảnh báo qua Telegram |
| `MAX_UPLOAD_MB` | Giới hạn multipart |
| `FOLDER_ZIP_MAX_FILES` | Tuỳ chọn — tối đa số file trong một lần `GET …/folders/:id/download` (ZIP đệ quy); mặc định 2000 trong code, trần 50000 |
| `REDIS_HOST`, `REDIS_PORT` | Redis queue — trong Compose: `redis` / `6379` |
| `REDIS_PASSWORD` | Tuỳ chọn — Redis có auth |
| `MYSQL_*` | Compose: `MYSQL_HOST=mysql`, `MYSQL_PORT=3306`, … |
| `MYSQL_ROOT_PASSWORD` | Khởi tạo volume MySQL lần đầu |
| `TYPEORM_SYNCHRONIZE` | `true` / `false` — prod nên `false` khi có migration |

Tuỳ chọn (mặc định trong code): `UPLOAD_TMP_DIR`, `UPLOAD_QUEUE_CONCURRENCY`.

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
| `GET` | `/api/v1/folders/:folderId/download` | ZIP đệ quy toàn bộ file trong thư mục + con (giữ cấu trúc đường dẫn); có giới hạn `FOLDER_ZIP_MAX_FILES` |
| `GET` | `/api/v1/folders/:folderId/contents` | `folderId` = `root` hoặc UUID. Query tuỳ chọn `folderLimit`, `folderCursor` phân trang thư mục con; `fileLimit`, `fileCursor` phân trang file (độc lập) |
| `DELETE` | `/api/v1/folders/:folderId` | UUID — không xóa gốc |
| `GET` | `/api/v1/files/search` | `q`, tuỳ chọn `folderId`, `mode`, `limit` |
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

**Upload — trùng tên:** query `duplicatePolicy=reject|overwrite|suffix` hoặc `overwrite=true`. **PATCH file** dùng cùng ý nghĩa khi đụng tên trong thư mục đích.

### Basic Auth

Global guard: **Basic Auth** cho hầu hết route (hai biến env không được để trống). Swagger nút **Authorize** (`basic-auth`). **`GET /api/v1/shared/files/*`** được đánh dấu public (`@Public()`): chỉ cần `token` hợp lệ. `OPTIONS` không chặn (CORS).

## Cấu trúc `src/`

- `app/` — module gốc
- `auth/` — Basic Auth guard
- `common/` — env keys, HTTP helpers, API messages, `api-route.ts`
- `storage/domain/` — entities, DTO, policy/cursor
- `storage/telegram/` — Telegram Bot API
- `storage/folder/`, `storage/file/` — REST
- `storage/admin/` — queue + reconcile
- `storage/queue/` — BullMQ processor & constants
- `storage/storage.service.ts`, `storage.module.ts`
- `swagger.setup.ts`

## Giới hạn & lưu ý

- **Cảnh báo Telegram:** chỉ bật khi đặt `TELEGRAM_ALERT_CHAT_ID`. Chỉ gửi cho lỗi **HTTP ≥500** (và mọi lỗi không bắt được như 500); lỗi 4xx (validation, 404, auth…) **không** gửi để tránh spam. Upload async thất bại **sau khi hết retry** cũng được gửi một tin.
- Kích thước file phụ thuộc Telegram (~50MB document). `MAX_UPLOAD_MB` trên API nên không vượt quá.
- Upload async cần Redis ổn định; job retry/backoff do BullMQ cấu hình trong `storage.module.ts`.
- `telegramMessageId` cần để xóa tin trên Telegram; bản ghi cũ thiếu cột có thể chỉ xóa DB.
- Prod: `TYPEORM_SYNCHRONIZE=false` + migration khi schema ổn định.

## Giấy phép

Private (`package.json`: `"private": true`).
