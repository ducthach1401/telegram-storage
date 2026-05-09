# Telegram Storage

Backend **NestJS** lưu file và ảnh qua **Telegram Bot API**: cấu trúc thư mục kiểu “drive”, thumbnail cho ảnh, stream xem/tải qua API. Metadata và cây thư mục nằm trên **MySQL** (TypeORM).

## Stack

- **NestJS 10**, **TypeORM**, **MySQL 8.4**, **Grammy**
- **Sharp** — thumbnail JPEG khi upload ảnh
- **Swagger** — tài liệu OpenAPI tại `/api/documentation`
- **Docker** — dev (`docker-compose.dev.yml`) & prod (`docker-compose.yml`), image prod chạy **PM2** (`pm2-runtime`)

## Yêu cầu

- **Node.js 22** (khớp Docker dev/prod)
- **Docker & Docker Compose** (nếu chạy bằng compose)

## Cấu hình

Sao chép `/.env.example` thành `/.env` và chỉnh giá trị thật (đặc biệt token Telegram và mật khẩu MySQL).

| Biến | Ý nghĩa |
|------|---------|
| `COMPOSE_PROJECT_NAME` | Tên project Compose (tùy chọn, trong `.env`) |
| `APP_PORT` | Cổng HTTP API |
| `SERVICE_NAME` | Chuỗi trả về tại `GET /api/v1` |
| `HOST` | Tuỳ chọn — bind HTTP; không có thì mặc định `0.0.0.0` (Docker) |
| `TELEGRAM_BOT_TOKEN` | Token từ BotFather |
| `TELEGRAM_STORAGE_CHAT_ID` | Chat/channel/group ID nơi bot được phép gửi file (thường `-100…`) |
| `MAX_UPLOAD_MB` | Giới hạn upload multipart |
| `MYSQL_*` | Host/port/user/password/database — trong Compose đặt `MYSQL_HOST=mysql` |
| `MYSQL_ROOT_PASSWORD` | Cho container MySQL khởi tạo lần đầu |
| `TYPEORM_SYNCHRONIZE` | `true` / `false` — dev có thể bật; production nên tắt khi có migration |
| `MYSQL_PUBLISH_PORT` | Map cổng MySQL ra host (Compose dev/prod đều dùng) |
| `API_BASIC_AUTH_USER` | Tuỳ chọn — user Basic Auth (mặc định `admin` khi đã bật auth) |
| `API_BASIC_AUTH_PASSWORD` | Tuỳ chọn — đặt **không trống** để bật Basic Auth (API + Swagger) |

Chạy **ngoài Docker** nhưng DB trong Compose: đặt `MYSQL_HOST=127.0.0.1`, `MYSQL_PORT` khớp `MYSQL_PUBLISH_PORT`.

## Chạy local (không Docker)

```bash
npm install
cp .env.example .env   # rồi sửa
npm run start:dev
```

Build production cục bộ:

```bash
npm run build
npm run start:prod
```

## Docker — development

Mount source, `npm install` khi container khởi động, watch Nest:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Docker — production

Build image (file `dockerfile`, multi-stage + PM2):

```bash
docker compose up --build -d
```

## API & Swagger

Sau khi chạy app, mở:

- **Swagger UI:** `http://localhost:<APP_PORT>/api/documentation`
- **OpenAPI JSON:** `http://localhost:<APP_PORT>/api/documentation/swagger.json`

### Endpoint chính

| Phương thức | Đường dẫn | Mô tả |
|-------------|-----------|--------|
| `GET` | `/api/v1` | Tên service (`SERVICE_NAME`, plain text) |
| `POST` | `/api/v1/folders` | Tạo thư mục |
| `GET` | `/api/v1/folders/:folderId/contents` | `folderId` = `root` hoặc UUID — liệt kê con |
| `DELETE` | `/api/v1/folders/:folderId` | Xóa thư mục + con + file (UUID); không xóa gốc |
| `POST` | `/api/v1/files/upload` | Multipart `file`, tuỳ chọn `folderId` |
| `DELETE` | `/api/v1/files/:id` | Xóa metadata file + cố gắng xóa tin Telegram (`204`) |
| `GET` | `/api/v1/files/:id` | Metadata file |
| `GET` | `/api/v1/files/:id/view` | Xem inline |
| `GET` | `/api/v1/files/:id/download` | Tải attachment |
| `GET` | `/api/v1/files/:id/thumbnail` | Thumbnail JPEG (nếu có) |

Prefix **`api/v1`** được khai báo trên từng controller qua `src/common/api-route.ts` (không dùng `setGlobalPrefix` trong bootstrap).

Plugin **`@nestjs/swagger`** trong `nest-cli.json` bổ sung metadata OpenAPI cho file `*.dto.ts` (kết hợp `class-validator`).

### Basic Auth (một user)

Đặt **`API_BASIC_AUTH_PASSWORD`** trong `.env` (không để trống) để bật guard toàn cục; **`API_BASIC_AUTH_USER`** mặc định là `admin`. Swagger có nút **Authorize** (scheme `basic-auth`). Preflight `OPTIONS` không chặn (CORS).

## Cấu trúc mã (`src/`)

- `app/` — module gốc, health/tên service
- `storage/domain/` — entities, DTO, constants
- `storage/telegram/` — gửi document & URL file Telegram
- `storage/folder/`, `storage/file/` — controller REST
- `storage/storage.service.ts`, `storage/storage.module.ts` — nghiệp vụ & wiring
- `auth/basic-auth.guard.ts` — Basic Auth theo env (`APP_GUARD`)
- `common/api-route.ts` — hằng `API_V1_PREFIX` (`api/v1`) dùng trên controller
- `swagger.setup.ts` — đăng ký `/api/documentation`

## Giới hạn & lưu ý

- Giới hạn kích thước file phụ thuộc Telegram Bot API (thực tế thường quanh **~50MB** cho document).
- File được bot đẩy lên chat lưu trữ; DB chỉ giữ **metadata** và `file_id` để tải lại.
- Prod: nên `TYPEORM_SYNCHRONIZE=false` và dùng migration khi ổn định schema.
- Xóa file trên Telegram dựa vào `telegramMessageId` (lưu từ lần upload); bản ghi cũ trước khi có cột này chỉ xóa DB. Bot cần quyền xóa tin trong chat lưu trữ.

## Giấy phép

Private project (`package.json`: `"private": true`).
