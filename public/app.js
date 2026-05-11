const API = "/api/v1";
const ROOT = "root";
const INTERNAL_DRAG_TYPE = "application/x-telegram-drive-item";
const AUTH_STORAGE_KEY = "tg-drive-basic-auth";

function readAuthCookie() {
  const m = document.cookie.match(/(?:^|;\s*)tg_drive_auth=([^;]*)/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}
const VIEW_STORAGE_KEY = "tg-drive-file-view";
const NAV_STORAGE_KEY = "tg-drive-nav-state";
const ACTIVE_TRANSFER_STORAGE_KEY = "tg-drive-active-transfers";

/** Khớp PATCH /admin/settings (không gồm queue worker). */
const RUNTIME_ADMIN_FORM_ROWS = [
  ["PUBLIC_APP_URL", "text"],
  ["TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID", "text"],
  ["TELEGRAM_ALERT_CHAT_ID", "text"],
  ["TELEGRAM_SYNC_FOLDER_ID", "text"],
  ["SHARE_RATE_LIMIT_TTL_MS", "number"],
  ["SHARE_RATE_LIMIT_MAX", "number"],
  ["FOLDER_ZIP_MAX_FILES", "number"],
  ["FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS", "number"],
  ["TELEGRAM_DOWNLOAD_MAX_MB", "number"],
  ["MYSQL_IMPORT_MAX_MB", "number"],
  ["MYSQL_BACKUP_ENABLED", "checkbox"],
  ["MYSQL_BACKUP_CRON", "text"],
  ["MYSQL_BACKUP_FOLDER_NAME", "text"],
];
const PREVIEW_CACHE_NAME = "tg-drive-preview-cache-v1";
const UPLOAD_DB_NAME = "tg-drive-upload-queue";
const UPLOAD_STORE_NAME = "uploads";
const UPLOAD_RETRY_DELAY_MS = 15000;
/** Poll GET …/upload/jobs/:id — worker Telegram có thể giữ job `active` vài phút. */
const UPLOAD_JOB_POLL_QUICK_MS = 1200;
const UPLOAD_JOB_POLL_MEDIUM_MS = 3000;
const UPLOAD_JOB_POLL_SLOW_MS = 5000;
const objectUrlCache = new Map();

function isCompactTransferMode() {
  return (
    window.matchMedia?.("(display-mode: standalone), (max-width: 640px), (hover: none), (pointer: coarse)").matches ??
    false
  );
}

const i18n = {
  vi: {
    brandSubtitle: "Cloud qua Telegram",
    upload: "Tải lên",
    uploadFiles: "Tải file lên",
    uploadMedia: "Thư viện ảnh/video",
    uploadFileManager: "Quản lý file",
    uploadFolder: "Tải folder lên",
    mergeFolder: "Merge",
    renameFolderCopy: "Tạo folder (1)",
    folderExistsTitle: "Folder đã tồn tại",
    folderExistsHint: "Folder này đã có trên server. Bạn muốn merge dữ liệu vào folder cũ hay tạo folder mới với hậu tố (1)?",
    logout: "Đăng xuất",
    loginTitle: "Đăng nhập",
    loginHint: "Đăng nhập tại /login.html — phiên lưu cho đến khi đăng xuất.",
    username: "Tài khoản",
    password: "Mật khẩu",
    login: "Đăng nhập",
    loginInvalid: "Sai tài khoản hoặc mật khẩu",
    transfers: "Tiến trình",
    uploading: "Đang upload",
    queued: "Đang chờ",
    downloading: "Đang tải",
    processing: "Đang xử lý",
    done: "Hoàn tất",
    cancelUpload: "Hủy",
    canceled: "Đã hủy",
    uploadTooLarge: "File vượt giới hạn lưu trữ MinIO",
    dropToUpload: "Thả file để upload",
    dropHint: "File/folder sẽ được lưu vào thư mục đang mở",
    drive: "Drive",
    images: "Ảnh",
    imagesHint: "Tất cả ảnh đã tải lên, mới nhất trước.",
    search: "Tìm kiếm",
    trash: "Thùng rác",
    queue: "Queue lỗi",
    settings: "Cài đặt",
    admin: "Admin/API",
    settingsHint: "Thông tin tài khoản và kết nối Telegram của bạn.",
    accountsNav: "Tài khoản",
    accountsTitle: "Quản lý tài khoản",
    accountsHint: "Điều chỉnh role, quota MinIO và trạng thái đăng nhập.",
    accountStatus: "Trạng thái",
    accountActive: "Hoạt động",
    accountInactive: "Vô hiệu",
    accountSaved: "Đã lưu tài khoản",
    settingsHintNonAdmin: "Thông tin tài khoản và kết nối Telegram.",
    telegramSaveConnection: "Lưu kết nối Telegram",
    minioQuotaLabel: "MinIO",
    adminAccountQuotaTitle: "Quota MinIO theo tài khoản (admin)",
    accountLabel: "Tài khoản",
    roleLabel: "Vai trò",
    accountMinioQuota: "Quota MinIO (account)",
    accountTelegramUsage: "Telegram đã dùng",
    accountMinioUsage: "MinIO đã dùng",
    minioDisabledHint: "Chưa bật quota MinIO — chỉ lưu qua Telegram (tối đa ~20MB/file).",
    quotaSaved: "Đã lưu quota",
    loadingProfile: "Đang tải…",
    saveQuota: "Lưu",
    telegramConnectionTitle: "Kết nối Telegram",
    usePlatformTelegramLabel: "Dùng bot và kênh lưu chung với hệ thống",
    usePlatformTelegramHint:
      "Bật: bot/kênh do hệ thống cấu hình; chat lưu ưu tiên TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID (Cài đặt server), không có thì chat đã lưu trên tài khoản admin. Tắt: bot và kênh riêng.",
    primaryAdminTelegramHint:
      "Admin: bot token + chat lưu (ô dưới hoặc TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID) phục vụ webhook và user “dùng chung”. Không chuyển sang chế độ chung.",
    telegramBotTokenLabel: "Bot token",
    telegramBotTokenKeepHint:
      "Để trống nếu chỉ đổi chat ID hoặc giữ nguyên token hiện tại.",
    telegramChatIdLabel: "Chat / channel ID lưu file",
    telegramSaved: "Đã lưu cấu hình Telegram",
    systemSettingsTitle: "Cấu hình server",
    systemSettingsHint:
      "`TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID` (chat lưu chung — chỉ UI/DB, không env), chat cảnh báo (`TELEGRAM_ALERT_CHAT_ID`), URL công khai, ZIP, backup MySQL… Bot token trên tài khoản admin (Cài đặt → Kết nối Telegram). Áp dụng ngay (worker queue chỉ đọc từ env khi khởi động).",
    runtimeSave: "Lưu cấu hình",
    runtimeSaved: "Đã lưu cấu hình server",
    queueWorkerTitle: "Upload queue (chỉ env)",
    runtimeOverridesHint: "Khóa trong app_settings (khởi tạo đủ khi chạy app lần đầu)",
    storage: "Dung lượng",
    quickSearch: "Tìm trong drive",
    newFolder: "Thư mục mới",
    eyebrow: "Quản lý file",
    title: "Drive riêng lưu trên Telegram",
    subtitle: "Upload, chia sẻ, gắn tag, khôi phục file và retry job lỗi trong một giao diện.",
    files: "Files",
    folders: "Folders",
    trashed: "Trong rác",
    myDrive: "Drive của tôi",
    listView: "List",
    gridView: "Grid",
    refresh: "Làm mới",
    advancedSearch: "Tìm kiếm nâng cao",
    advancedSearchHint: "Lọc theo tên, MIME, dung lượng, ngày tạo, thumbnail và tag.",
    advancedFilters: "Bộ lọc nâng cao",
    searchResults: "Kết quả tìm kiếm",
    clearSearch: "Xóa tìm kiếm",
    nameContains: "Tên chứa...",
    tagsComma: "tag1, tag2",
    minSize: "Size min",
    maxSize: "Size max",
    anyThumbnail: "Thumbnail bất kỳ",
    hasThumbnail: "Có thumbnail",
    noThumbnail: "Không thumbnail",
    trashHint: "File xóa mềm có thể khôi phục hoặc xóa vĩnh viễn.",
    emptyTrash: "Xóa toàn bộ",
    confirmEmptyTrash: "Xóa vĩnh viễn toàn bộ file và folder trong thùng rác?",
    queueHint: "Retry các upload job đã fail nhưng còn file tạm.",
    retryAll: "Retry tất cả",
    adminHint: "Công cụ quản trị dùng các API còn lại của source.",
    queueStats: "Queue stats",
    queueStatsHint: "Xem số job upload theo trạng thái.",
    queueWorkers: "Queue workers",
    queueWorkersHint: "Kiểm tra worker đang kết nối Redis.",
    duplicates: "File trùng",
    duplicatesHint: "Tìm file có cùng Telegram unique id.",
    deleteDuplicates: "Xóa duplicate",
    confirmDeleteDuplicates: "Giữ bản cũ nhất mỗi nhóm và đưa các file duplicate còn lại vào thùng rác?",
    reconcileDryRun: "Reconcile dry-run",
    reconcileDryRunHint: "Quét metadata lỗi nhưng chưa xóa.",
    reconcileApply: "Reconcile xóa lỗi",
    reconcileApplyHint: "Xóa metadata không còn tải được từ Telegram.",
    mysqlImport: "Import MySQL",
    mysqlImportHint: "Import file .sql hoặc .sql.gz.",
    adminOutputHint: "Chọn một tính năng admin để xem kết quả.",
    view: "Xem",
    run: "Chạy",
    selectFile: "Chọn file",
    downloadZip: "Tải folder",
    zipAsync: "ZIP queue",
    copyFolder: "Copy folder",
    deleteFolder: "Xóa folder",
    rename: "Đổi tên",
    move: "Di chuyển",
    info: "Thông tin",
    thumb: "Thumb",
    rightClickHint: "Click phải để mở menu",
    open: "Mở",
    openFile: "Mở",
    download: "Tải xuống",
    share: "Chia sẻ",
    tags: "Gắn tag",
    delete: "Xóa",
    restore: "Khôi phục",
    permanentDelete: "Xóa hẳn",
    retry: "Retry",
    deleteRetryFile: "Xóa file retry",
    moveSelected: "Di chuyển",
    deleteSelected: "Xóa",
    selectedItems: "mục đã chọn",
    unlimited: "unlimited",
    chooseFolder: "Chọn thư mục",
    chooseThisFolder: "Chọn thư mục này",
    parentFolder: "..",
    noSubfolders: "Không có thư mục con",
    confirmDeleteSelected: "Xóa các mục đã chọn?",
    selectMode: "Chọn nhiều",
    selectModeDone: "Xong",
    cancel: "Hủy",
    confirm: "Xác nhận",
    empty: "Chưa có dữ liệu",
    root: "/",
    folderNamePrompt: "Tên thư mục mới",
    tagsPrompt: "Nhập tag, phân tách bằng dấu phẩy",
    uploaded: "Đã đưa file vào queue upload",
    folderUploadDone: "Upload folder hoàn tất",
    uploadCompleted: "Upload hoàn tất",
    uploadFailed: "Upload lỗi",
    downloadInterrupted: "Gián đoạn khi tải lại trang",
    retryDownload: "Tải lại",
    reloadTransferTitle: "Tải lại trang?",
    reloadTransferWarning: "Tải lại trang có thể gián đoạn upload và download đang chạy.",
    duplicateImageTitle: "Ảnh đã tồn tại",
    duplicateImageHint: "Ảnh này đã có trong cùng thư mục. Bạn muốn vẫn add thêm một bản mới hay bỏ qua và tắt tiến trình này?",
    addDuplicateAnyway: "Vẫn add",
    skipDuplicateUpload: "Bỏ qua",
    duplicateSkipped: "Đã bỏ qua ảnh trùng",
    uploadJobTimedOut: "Hết thời gian chờ xử lý server",
    uploadJobTimedOutToast:
      "Tiến trình dừng theo dõi — upload có thể vẫn chạy nền. Kiểm tra Drive hoặc Queue lỗi.",
    folderPickerUnsupported: "Trình duyệt này chưa hỗ trợ chọn folder không popup. Hãy kéo thả folder vào Drive.",
    folderCreated: "Đã tạo thư mục",
    copied: "Đã copy link",
    retryDone: "Đã gửi retry",
    saved: "Đã lưu",
    deleted: "Đã xóa",
    restored: "Đã khôi phục",
    moved: "Đã di chuyển",
    unsupportedPreview: "Không hỗ trợ xem trước",
    unsupportedPreviewHint: "File này chưa thể xem trực tiếp trên giao diện. Bạn vẫn có thể tải xuống để mở bằng ứng dụng phù hợp.",
    openTelegram: "Mở trong Telegram",
    telegramLinkMissing: "File này chưa có link message Telegram để mở trực tiếp.",
    zipReady: "ZIP đã sẵn sàng",
    folderCopied: "Đã copy folder",
    folderDeleted: "Đã xóa folder",
    renamePrompt: "Tên mới",
    movePrompt: "Folder ID đích hoặc root",
    confirmDeleteFolder: "Xóa folder hiện tại và toàn bộ nội dung?",
    confirmReconcile: "Chạy reconcile thật và xóa metadata lỗi?",
    inputRequired: "Vui lòng nhập thông tin",
    imported: "Đã import",
    authHint: "Nếu hết phiên, mở /login.html để đăng nhập lại.",
  },
  en: {
    brandSubtitle: "Cloud through Telegram",
    upload: "Upload",
    uploadFiles: "Upload files",
    uploadMedia: "Photo/video library",
    uploadFileManager: "File manager",
    uploadFolder: "Upload folder",
    mergeFolder: "Merge",
    renameFolderCopy: "Create folder (1)",
    folderExistsTitle: "Folder already exists",
    folderExistsHint: "This folder already exists on the server. Do you want to merge into it or create a new folder with suffix (1)?",
    logout: "Logout",
    loginTitle: "Sign in",
    loginHint: "Sign in at /login.html — session persists until you log out.",
    username: "Username",
    password: "Password",
    login: "Sign in",
    loginInvalid: "Invalid username or password",
    transfers: "Transfers",
    uploading: "Uploading",
    queued: "Queued",
    downloading: "Downloading",
    processing: "Processing",
    done: "Done",
    cancelUpload: "Cancel",
    canceled: "Canceled",
    uploadTooLarge: "File exceeds the MinIO storage limit",
    dropToUpload: "Drop files to upload",
    dropHint: "Files/folders will be saved into the current folder",
    drive: "Drive",
    images: "Images",
    imagesHint: "All uploaded images, newest first.",
    search: "Search",
    trash: "Trash",
    queue: "Failed queue",
    settings: "Settings",
    admin: "Admin/API",
    settingsHint: "Your account info and Telegram connection.",
    accountsNav: "Accounts",
    accountsTitle: "Account management",
    accountsHint: "Edit role, MinIO quota, and login status.",
    accountStatus: "Status",
    accountActive: "Active",
    accountInactive: "Inactive",
    accountSaved: "Account saved",
    settingsHintNonAdmin: "Account info and Telegram connection.",
    telegramSaveConnection: "Save Telegram connection",
    minioQuotaLabel: "MinIO",
    adminAccountQuotaTitle: "Per-account MinIO quota (admin)",
    accountLabel: "Account",
    roleLabel: "Role",
    accountMinioQuota: "Account MinIO quota",
    accountTelegramUsage: "Telegram used",
    accountMinioUsage: "MinIO used",
    minioDisabledHint: "MinIO quota off — Telegram-only storage (~20MB/file max).",
    quotaSaved: "Quota saved",
    loadingProfile: "Loading…",
    saveQuota: "Save",
    telegramConnectionTitle: "Telegram connection",
    usePlatformTelegramLabel: "Use the system's shared bot and storage channel",
    usePlatformTelegramHint:
      "On: bot/channel configured for the system; storage chat prefers `TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID` (server settings), else the chat saved on the admin account. Off: your own bot and channel.",
    primaryAdminTelegramHint:
      "Admin: bot token + storage chat (below or `TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID`) for the webhook and shared defaults. Cannot switch to shared mode.",
    telegramBotTokenLabel: "Bot token",
    telegramBotTokenKeepHint: "Leave empty to keep your current token when changing only the chat ID.",
    telegramChatIdLabel: "Storage chat / channel ID",
    telegramSaved: "Telegram settings saved",
    systemSettingsTitle: "Server settings",
    systemSettingsHint:
      "`TELEGRAM_STORAGE_CHAT_FOR_PUBLIC_ID` (shared storage — UI/DB only, not env), alert chat (`TELEGRAM_ALERT_CHAT_ID`), public URL, ZIP, MySQL backup… Bot token on the admin account (Settings → Telegram connection). Applied immediately (upload queue still reads env at worker startup).",
    runtimeSave: "Save settings",
    runtimeSaved: "Server settings saved",
    queueWorkerTitle: "Upload queue (env only)",
    runtimeOverridesHint: "Keys in app_settings (all seeded on first app boot)",
    storage: "Storage",
    quickSearch: "Search in drive",
    newFolder: "New folder",
    eyebrow: "File manager",
    title: "Private drive backed by Telegram",
    subtitle: "Upload, share, tag, restore files and retry failed jobs in one interface.",
    files: "Files",
    folders: "Folders",
    trashed: "Trashed",
    myDrive: "My Drive",
    listView: "List",
    gridView: "Grid",
    refresh: "Refresh",
    advancedSearch: "Advanced search",
    advancedSearchHint: "Filter by name, MIME, size, creation date, thumbnails and tags.",
    advancedFilters: "Advanced filters",
    searchResults: "Search results",
    clearSearch: "Clear search",
    nameContains: "Name contains...",
    tagsComma: "tag1, tag2",
    minSize: "Min size",
    maxSize: "Max size",
    anyThumbnail: "Any thumbnail",
    hasThumbnail: "Has thumbnail",
    noThumbnail: "No thumbnail",
    trashHint: "Soft-deleted files can be restored or permanently removed.",
    emptyTrash: "Empty trash",
    confirmEmptyTrash: "Permanently delete every file and folder in trash?",
    queueHint: "Retry failed upload jobs that still have a temp file.",
    retryAll: "Retry all",
    adminHint: "Admin tools backed by the remaining source APIs.",
    queueStats: "Queue stats",
    queueStatsHint: "View upload job counts by state.",
    queueWorkers: "Queue workers",
    queueWorkersHint: "Check workers connected through Redis.",
    duplicates: "Duplicates",
    duplicatesHint: "Find files with the same Telegram unique id.",
    deleteDuplicates: "Delete duplicates",
    confirmDeleteDuplicates: "Keep the oldest file in each group and move the remaining duplicates to trash?",
    reconcileDryRun: "Reconcile dry-run",
    reconcileDryRunHint: "Scan broken metadata without deleting it.",
    reconcileApply: "Reconcile cleanup",
    reconcileApplyHint: "Delete metadata that can no longer be downloaded from Telegram.",
    mysqlImport: "Import MySQL",
    mysqlImportHint: "Import a .sql or .sql.gz file.",
    adminOutputHint: "Choose an admin feature to view results.",
    view: "View",
    run: "Run",
    selectFile: "Select file",
    downloadZip: "Download folder",
    zipAsync: "Queue ZIP",
    copyFolder: "Copy folder",
    deleteFolder: "Delete folder",
    rename: "Rename",
    move: "Move",
    info: "Details",
    thumb: "Thumb",
    rightClickHint: "Right click for menu",
    open: "Open",
    openFile: "Open",
    download: "Download",
    share: "Share",
    tags: "Tags",
    delete: "Delete",
    restore: "Restore",
    permanentDelete: "Delete forever",
    retry: "Retry",
    deleteRetryFile: "Delete retry file",
    moveSelected: "Move",
    deleteSelected: "Delete",
    selectedItems: "items selected",
    unlimited: "unlimited",
    chooseFolder: "Choose folder",
    chooseThisFolder: "Choose this folder",
    parentFolder: "..",
    noSubfolders: "No subfolders",
    confirmDeleteSelected: "Delete selected items?",
    selectMode: "Select",
    selectModeDone: "Done",
    cancel: "Cancel",
    confirm: "Confirm",
    empty: "No data yet",
    root: "/",
    folderNamePrompt: "New folder name",
    tagsPrompt: "Enter tags separated by commas",
    uploaded: "File queued for upload",
    folderUploadDone: "Folder upload completed",
    uploadCompleted: "Upload completed",
    uploadFailed: "Upload failed",
    downloadInterrupted: "Interrupted by page reload",
    retryDownload: "Retry download",
    reloadTransferTitle: "Reload page?",
    reloadTransferWarning: "Reloading may interrupt active uploads and downloads.",
    duplicateImageTitle: "Image already exists",
    duplicateImageHint: "This image already exists in the same folder. Add another copy anyway, or skip it and remove this transfer?",
    addDuplicateAnyway: "Add anyway",
    skipDuplicateUpload: "Skip",
    duplicateSkipped: "Duplicate image skipped",
    uploadJobTimedOut: "Timed out waiting for server processing",
    uploadJobTimedOutToast:
      "Stopped polling — the upload may still run in the background. Check Drive or the failed queue.",
    folderPickerUnsupported: "This browser does not support popup-free folder picking. Drag and drop the folder into Drive instead.",
    folderCreated: "Folder created",
    copied: "Link copied",
    retryDone: "Retry queued",
    saved: "Saved",
    deleted: "Deleted",
    restored: "Restored",
    moved: "Moved",
    unsupportedPreview: "Preview not supported",
    unsupportedPreviewHint: "This file cannot be previewed in the app yet. You can still download it and open it with a suitable app.",
    openTelegram: "Open in Telegram",
    telegramLinkMissing: "This file does not have a Telegram message link yet.",
    zipReady: "ZIP is ready",
    folderCopied: "Folder copied",
    folderDeleted: "Folder deleted",
    renamePrompt: "New name",
    movePrompt: "Target folder ID or root",
    confirmDeleteFolder: "Delete current folder and all contents?",
    confirmReconcile: "Run real reconcile and delete broken metadata?",
    inputRequired: "Please enter a value",
    imported: "Imported",
    authHint: "If your session expired, open /login.html to sign in again.",
  },
};

const state = {
  lang: localStorage.getItem("tg-drive-lang") || "vi",
  view: "drive",
  folderId: ROOT,
  path: [{ id: ROOT, name: "root" }],
  trashFolderId: ROOT,
  trashPath: [],
  dragDepth: 0,
  loadingFolderId: null,
  authToken: localStorage.getItem(AUTH_STORAGE_KEY) || readAuthCookie(),
  fileView: localStorage.getItem(VIEW_STORAGE_KEY) || "list",
  searchActive: false,
  driveFolders: [],
  driveFiles: [],
  selectedFolderIds: new Set(),
  selectedFileIds: new Set(),
  processingFolderIds: new Set(),
  selectionAnchor: null,
  visibleFolders: [],
  visibleFiles: [],
  previewIndex: -1,
  previewToken: 0,
  transfers: new Map(),
  transferAborters: new Map(),
  transferCollapsed: isCompactTransferMode(),
  transferAutoClearTimer: null,
  uploadProcessing: false,
  uploadRetryTimer: null,
  uploadQueueSuppressed: false,
  maxUploadBytes: 50 * 1024 * 1024 * 1024,
  selectionMode: false,
  /** Ignore backdrop closes immediately after open (double-click ghost click). */
  previewBackdropGuardUntil: 0,
  /** Payload gần nhất từ GET /auth/verify (sau applyAppConfig). */
  accountProfile: null,
  adminSettingsTab: "config",
};

function parseStoredJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const t = (key) => i18n[state.lang][key] || key;

function accountIsAdmin() {
  return String(state.accountProfile?.role ?? "").toLowerCase() === "admin";
}

function isAdminOnlyView(view) {
  return view === "admin" || view === "queue" || view === "accounts";
}

function isFileBrowserView(view = state.view) {
  return view === "drive" || view === "images";
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[idx]}`;
}

function formatAdminMinioUsage(minioBytes, limitBytes) {
  const used = Number(minioBytes || 0);
  const limit = Number(limitBytes || 0);
  if (limit <= 0) {
    return formatBytes(used);
  }
  return `${formatBytes(used)} / ${formatBytes(limit)}`;
}

function formatSpeed(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

let transferRenderRaf = null;
let persistTransfersTimer = null;

function snapshotActiveTransfers() {
  return [...state.transfers.values()]
    .filter((item) => isActiveTransfer(item) || transferCanRetryDownload(item))
    .map((item) => {
      const snapshot = {
        id: item.id,
        kind: item.kind,
        name: item.name,
        status: item.status,
        loaded: item.loaded,
        total: item.total,
        startedAt: item.startedAt,
        updatedAt: item.updatedAt,
        error: Boolean(item.error),
      };
      if (item.kind === "download" && item.downloadUrl) {
        snapshot.downloadUrl = item.downloadUrl;
        snapshot.knownTotalBytes = Number(item.knownTotalBytes ?? item.total ?? 0);
      }
      return snapshot;
    });
}

function persistActiveTransferSnapshots() {
  try {
    sessionStorage.setItem(ACTIVE_TRANSFER_STORAGE_KEY, JSON.stringify(snapshotActiveTransfers()));
  } catch {
    // sessionStorage có thể đầy hoặc bị chặn.
  }
}

function schedulePersistActiveTransfers() {
  if (persistTransfersTimer) clearTimeout(persistTransfersTimer);
  persistTransfersTimer = setTimeout(() => {
    persistTransfersTimer = null;
    persistActiveTransferSnapshots();
  }, 200);
}

function clearActiveTransferSnapshots() {
  try {
    sessionStorage.removeItem(ACTIVE_TRANSFER_STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}

function restoreActiveTransferSnapshots() {
  let saved = [];
  try {
    saved = JSON.parse(sessionStorage.getItem(ACTIVE_TRANSFER_STORAGE_KEY) || "[]");
  } catch {
    saved = [];
  }
  clearActiveTransferSnapshots();
  for (const item of saved) {
    if (!item?.id || state.transfers.has(item.id)) continue;
    const interrupted = item.kind === "download";
    state.transfers.set(item.id, {
      id: item.id,
      kind: item.kind,
      name: item.name,
      status: interrupted ? t("downloadInterrupted") : item.status,
      loaded: Number(item.loaded || 0),
      total: Number(item.total || 0),
      speed: 0,
      startedAt: item.startedAt || performance.now(),
      updatedAt: item.updatedAt || performance.now(),
      cancelable: false,
      error: interrupted || Boolean(item.error),
      downloadUrl: item.downloadUrl || null,
      knownTotalBytes: Number(item.knownTotalBytes ?? item.total ?? 0),
    });
  }
  if (saved.length) {
    renderTransfers();
  }
}

function scheduleTransferRender() {
  if (transferRenderRaf !== null) return;
  transferRenderRaf = requestAnimationFrame(() => {
    transferRenderRaf = null;
    renderTransfers();
  });
}

function nextTransferSpeed(transferId, sample) {
  const item = state.transfers.get(transferId);
  if (!item) return sample;
  const prev = Number(item.speed || 0);
  if (!Number.isFinite(sample) || sample <= 0) return prev;
  if (!Number.isFinite(prev) || prev <= 0) return sample;
  return prev * 0.65 + sample * 0.35;
}

function measureTransferSpeed(transferId, loaded, lastLoaded, lastTime) {
  const item = state.transfers.get(transferId);
  if (!item || loaded <= 0) return Number(item?.speed || 0);
  const now = performance.now();
  const elapsed = Math.max(1, now - lastTime) / 1000;
  const instantSpeed = lastTime ? (loaded - lastLoaded) / elapsed : 0;
  const averageSpeed = loaded / Math.max(0.001, (now - item.startedAt) / 1000);
  const sample = instantSpeed > 0 ? instantSpeed : averageSpeed;
  return nextTransferSpeed(transferId, sample);
}

function transferDisplaySpeed(item) {
  const speed = Number(item.speed || 0);
  if (Number.isFinite(speed) && speed > 0) {
    return formatSpeed(speed);
  }
  const measuring = item.status === t("uploading") || item.status === t("downloading");
  if (!measuring || item.loaded <= 0 || !item.startedAt) {
    return "--/s";
  }
  const elapsed = Math.max(0.001, (performance.now() - item.startedAt) / 1000);
  return formatSpeed(item.loaded / elapsed);
}

function transferIsMeasuring(item) {
  return item.status === t("uploading") || item.status === t("downloading");
}

function transferProgressParts(item) {
  const loaded = Math.max(0, Number(item.loaded || 0));
  const total = Math.max(0, Number(item.total || 0));
  const hasKnownTotal = total > 0;
  const pct = hasKnownTotal ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const sizeText = hasKnownTotal
    ? `${formatBytes(loaded)}/${formatBytes(total)}`
    : loaded > 0
      ? formatBytes(loaded)
      : formatBytes(0);
  const indeterminate = !hasKnownTotal && loaded > 0 && transferIsMeasuring(item);
  return { pct, sizeText, indeterminate, hasKnownTotal };
}

function formatUploadedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(state.lang === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function createTransfer(kind, name, id = `${Date.now()}-${Math.random().toString(16).slice(2)}`) {
  state.transfers.set(id, {
    id,
    kind,
    name,
    status: kind === "upload" ? t("uploading") : t("downloading"),
    loaded: 0,
    total: 0,
    speed: 0,
    startedAt: performance.now(),
    updatedAt: performance.now(),
  });
  renderTransfers();
  schedulePersistActiveTransfers();
  return id;
}

function updateTransfer(id, patch) {
  const item = state.transfers.get(id);
  if (!item) return;
  Object.assign(item, patch);
  item.updatedAt = performance.now();
  scheduleTransferRender();
  schedulePersistActiveTransfers();
  scheduleTransferAutoClear();
}

function finishTransfer(id, status = t("done")) {
  updateTransfer(id, { loaded: state.transfers.get(id)?.total || 1, status, speed: 0, cancelable: false });
}

function isActiveTransfer(item) {
  return item.cancelable || item.error || item.status !== t("done");
}

function transferCanRetryDownload(item) {
  return item.kind === "download" && Boolean(item.downloadUrl) && Boolean(item.error);
}

function hasOngoingPageTransfers() {
  if (state.uploadProcessing) return true;
  return [...state.transfers.values()].some((item) => {
    if (transferCanRetryDownload(item)) return false;
    if (item.status === t("done") || item.status === t("canceled")) return false;
    if (item.error && !item.cancelable) return false;
    return true;
  });
}

let reloadGuardBypass = false;
let reloadConfirmationPending = false;
let reloadTransferModalPromise = null;

function isReloadShortcut(event) {
  if (event.repeat) return false;
  if (event.code === "F5" || event.key === "F5") return true;
  if ((event.ctrlKey || event.metaKey) && (event.code === "KeyR" || event.key.toLowerCase() === "r")) return true;
  return false;
}

function isReloadNavigation(event) {
  if (event.navigationType === "reload") return true;
  const destination = event.destination;
  if (!destination?.sameDocument) return false;
  try {
    return destination.url === window.location.href;
  } catch {
    return false;
  }
}

function openReloadTransferModal() {
  if (reloadTransferModalPromise) return reloadTransferModalPromise;
  const backdrop = $("#reloadTransferBackdrop");
  if (!backdrop) {
    return openConfirmModal({
      title: t("reloadTransferTitle"),
      description: t("reloadTransferWarning"),
    });
  }
  reloadTransferModalPromise = new Promise((resolve) => {
    let settled = false;
    const finish = (confirmed) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeydown, true);
      backdrop.classList.add("hidden");
      backdrop.setAttribute("aria-hidden", "true");
      $("#reloadTransferCancelButton").onclick = null;
      $("#reloadTransferConfirmButton").onclick = null;
      backdrop.onclick = null;
      reloadTransferModalPromise = null;
      resolve(confirmed);
    };
    const onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finish(false);
    };
    $("#reloadTransferTitle").textContent = t("reloadTransferTitle");
    $("#reloadTransferDescription").textContent = t("reloadTransferWarning");
    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
    $("#reloadTransferCancelButton").onclick = () => finish(false);
    $("#reloadTransferConfirmButton").onclick = () => finish(true);
    backdrop.onclick = (event) => {
      if (event.target === backdrop) finish(false);
    };
    document.addEventListener("keydown", onKeydown, true);
    setTimeout(() => $("#reloadTransferConfirmButton")?.focus(), 0);
  });
  return reloadTransferModalPromise;
}

async function confirmReloadPage() {
  if (reloadGuardBypass || reloadConfirmationPending) return;
  reloadConfirmationPending = true;
  try {
    if (hasOngoingPageTransfers()) {
      const confirmed = await openReloadTransferModal();
      if (!confirmed) return;
    }
    reloadGuardBypass = true;
    persistActiveTransferSnapshots();
    if (window.navigation?.reload) {
      await window.navigation.reload();
      return;
    }
    window.location.reload();
  } finally {
    reloadConfirmationPending = false;
  }
}

function handleReloadNavigation(event) {
  if (reloadGuardBypass || !isReloadNavigation(event) || !hasOngoingPageTransfers()) return;
  const runPrompt = () => confirmReloadPage();
  if (typeof event.intercept === "function" && event.canIntercept) {
    event.intercept({
      handler() {
        return runPrompt();
      },
    });
    return;
  }
  if (!event.cancelable) return;
  event.preventDefault();
  void runPrompt();
}

function wireReloadTransferGuard() {
  if (window.navigation?.addEventListener) {
    window.navigation.addEventListener("navigate", handleReloadNavigation, { capture: true });
  }
  window.addEventListener(
    "keydown",
    (event) => {
      if (!isReloadShortcut(event) || !hasOngoingPageTransfers()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void confirmReloadPage();
    },
    { capture: true },
  );
}

async function retryDownloadTransfer(item) {
  if (!transferCanRetryDownload(item)) return;
  const { downloadUrl, name, knownTotalBytes, total } = item;
  state.transfers.delete(item.id);
  renderTransfers();
  schedulePersistActiveTransfers();
  await downloadWithAuth(downloadUrl, name, { knownTotalBytes: knownTotalBytes ?? total });
}

function scheduleTransferAutoClear() {
  if (state.transferAutoClearTimer) {
    clearTimeout(state.transferAutoClearTimer);
    state.transferAutoClearTimer = null;
  }
  if (state.transfers.size === 0) return;
  if ([...state.transfers.values()].some(isActiveTransfer)) return;
  state.transferAutoClearTimer = setTimeout(() => {
    state.transferAutoClearTimer = null;
    if ([...state.transfers.values()].some(isActiveTransfer)) return;
    state.transfers.clear();
    renderTransfers();
    clearActiveTransferSnapshots();
  }, 1200);
}

function renderTransfers() {
  const panel = $("#transferPanel");
  const list = $("#transferList");
  const collapseButton = $("#transferCollapseButton");
  const items = [...state.transfers.values()].reverse();
  const activeCount = items.filter(isActiveTransfer).length;
  const compact = isCompactTransferMode();
  panel.classList.toggle("hidden", items.length === 0);
  panel.classList.toggle("collapsed", state.transferCollapsed);
  panel.classList.toggle("compact", compact);
  collapseButton.setAttribute("aria-label", state.transferCollapsed ? t("transfers") : t("cancel"));
  collapseButton.textContent = state.transferCollapsed && compact ? `↑${activeCount || items.length}` : state.transferCollapsed ? "+" : "−";
  list.innerHTML = "";
  items.forEach((item) => {
    const { pct, sizeText, indeterminate, hasKnownTotal } = transferProgressParts(item);
    const speedText = transferDisplaySpeed(item);
    const row = document.createElement("div");
    row.className = `transfer-item ${item.error ? "error" : ""}`;
    row.innerHTML = `
      <div class="transfer-title">
        <span class="transfer-name">${escapeHtml(item.name)}</span>
        <span class="transfer-meta">${hasKnownTotal ? `${pct}%` : indeterminate ? "…" : "0%"} · ${speedText}</span>
      </div>
      <div class="transfer-detail">
        <span class="muted">${sizeText} · ${escapeHtml(item.status)}</span>
      </div>
      <div class="transfer-progress${indeterminate ? " indeterminate" : ""}"><span style="width:${indeterminate ? "100" : pct}%"></span></div>
    `;
    const detail = row.querySelector(".transfer-detail");
    if (transferCanRetryDownload(item)) {
      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.className = "transfer-retry";
      retryButton.textContent = t("retryDownload");
      retryButton.addEventListener("click", () => void retryDownloadTransfer(item).catch(showError));
      detail.appendChild(retryButton);
    }
    if (item.cancelable) {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "transfer-cancel";
      cancelButton.textContent = t("cancelUpload");
      cancelButton.addEventListener("click", () => void cancelTransfer(item.id).catch(showError));
      detail.appendChild(cancelButton);
    }
    list.appendChild(row);
  });
}

function toggleTransfersCollapsed() {
  state.transferCollapsed = !state.transferCollapsed;
  renderTransfers();
}

function isTransferCanceled(err) {
  return err?.name === "AbortError" || err?.code === "TRANSFER_CANCELED";
}

function transferCanceledError() {
  const err = new Error(t("canceled"));
  err.name = "AbortError";
  err.code = "TRANSFER_CANCELED";
  return err;
}

async function cancelTransfer(id) {
  const item = state.transfers.get(id);
  if (!item?.cancelable) return;
  const abort = state.transferAborters.get(id);
  if (abort) {
    abort();
  }
  await deleteUploadRecord(id);
  updateTransfer(id, { status: t("canceled"), error: true, speed: 0, cancelable: false });
  setTimeout(() => {
    const current = state.transfers.get(id);
    if (current?.status === t("canceled")) {
      state.transfers.delete(id);
      renderTransfers();
    }
  }, 1200);
}

function clearCompletedTransfers() {
  if (state.transferAutoClearTimer) {
    clearTimeout(state.transferAutoClearTimer);
    state.transferAutoClearTimer = null;
  }
  for (const [id, item] of state.transfers.entries()) {
    if (item.status === t("done") || item.error) {
      state.transfers.delete(id);
    }
  }
  renderTransfers();
}

function openUploadDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(UPLOAD_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(UPLOAD_STORE_NAME)) {
        db.createObjectStore(UPLOAD_STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function uploadStore(mode = "readonly") {
  const db = await openUploadDb();
  return db.transaction(UPLOAD_STORE_NAME, mode).objectStore(UPLOAD_STORE_NAME);
}

async function putUploadRecord(record) {
  const store = await uploadStore("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteUploadRecord(id) {
  const store = await uploadStore("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearUploadDb() {
  const store = await uploadStore("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearPendingUploads() {
  state.uploadQueueSuppressed = true;
  if (state.uploadRetryTimer) {
    clearTimeout(state.uploadRetryTimer);
    state.uploadRetryTimer = null;
  }
  for (const [id, abort] of [...state.transferAborters.entries()]) {
    if (state.transfers.get(id)?.kind === "upload") {
      abort?.();
    }
  }
  for (const [id, item] of [...state.transfers.entries()]) {
    if (item.kind !== "upload") continue;
    state.transfers.delete(id);
    state.transferAborters.delete(id);
  }
  try {
    await clearUploadDb();
  } catch {
    // Best-effort trước khi chuyển sang login.
  }
  clearActiveTransferSnapshots();
  renderTransfers();
}

async function getAllUploadRecords() {
  const store = await uploadStore("readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueUpload(file, folderId = state.folderId) {
  if (state.uploadQueueSuppressed) {
    return null;
  }
  if (isLikelyDirectoryPlaceholderFile(file, inferRootNameFromFile(file))) {
    return null;
  }
  if (!canUploadFile(file)) {
    return null;
  }
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const record = {
    id,
    file,
    fileName: file.name,
    folderId,
    status: "queued",
    createdAt: Date.now(),
  };
  await putUploadRecord(record);
  createTransfer("upload", file.name, id);
  updateTransfer(id, {
    status: t("queued"),
    loaded: 0,
    total: file.size,
    speed: 0,
    cancelable: true,
  });
  void processUploadQueue().catch(showError);
  return id;
}

function canUploadFile(file) {
  if (!file) return false;
  if (file.size <= state.maxUploadBytes) return true;
  toast(`${t("uploadTooLarge")}: ${file.name} (${formatBytes(file.size)} > ${formatBytes(state.maxUploadBytes)})`);
  return false;
}

async function restoreUploadTransfers() {
  const records = await getAllUploadRecords();
  records.forEach((record) => {
    createTransfer("upload", record.fileName, record.id);
    const total = record.file?.size || 0;
    const resumed = Boolean(record.jobId);
    updateTransfer(record.id, {
      status: resumed ? t("processing") : record.status === "uploading" ? t("uploading") : t("queued"),
      loaded: resumed ? total : 0,
      total,
      speed: 0,
      cancelable: !resumed,
    });
  });
}

async function processUploadQueue() {
  if (state.uploadQueueSuppressed) return;
  if (state.uploadProcessing) return;
  if (state.uploadRetryTimer) {
    clearTimeout(state.uploadRetryTimer);
    state.uploadRetryTimer = null;
  }
  state.uploadProcessing = true;
  try {
    while (true) {
      if (state.uploadQueueSuppressed) return;
      const now = Date.now();
      const records = (await getAllUploadRecords()).sort((a, b) => a.createdAt - b.createdAt);
      const record = records.find((item) => !item.retryAfter || item.retryAfter <= now);
      if (!record && records.length) {
        const nextRetryAt = Math.min(...records.map((item) => item.retryAfter || now));
        scheduleUploadQueue(Math.max(1000, nextRetryAt - now));
        return;
      }
      if (!record) return;
      try {
        if (!record.jobId) {
          record.status = "uploading";
          await putUploadRecord(record);
          updateTransfer(record.id, {
            status: t("uploading"),
            loaded: 0,
            total: record.file?.size || 0,
            speed: 0,
            cancelable: true,
            error: false,
          });
          const queued = await uploadFileRecord(record);
          record.jobId = queued.jobId;
        }
        updateTransfer(record.id, {
          status: t("processing"),
          speed: 0,
          error: false,
          cancelable: false,
          loaded: record.file?.size || 0,
          total: record.file?.size || 0,
        });
        const result = await watchUploadJob(record.jobId, record.id, record.file?.size ?? 0);
        if (result === "addDuplicateAnyway") {
          record.allowDuplicateContent = true;
          record.status = "queued";
          record.createdAt = Date.now();
          delete record.retryAfter;
          delete record.jobId;
          await putUploadRecord(record);
          updateTransfer(record.id, { status: t("queued"), loaded: 0, total: record.file.size, speed: 0, cancelable: true, error: false });
          continue;
        }
        await deleteUploadRecord(record.id);
      } catch (err) {
        if (isTransferCanceled(err)) {
          await deleteUploadRecord(record.id);
          continue;
        }
        record.status = "queued";
        record.createdAt = Date.now();
        record.retryAfter = Date.now() + UPLOAD_RETRY_DELAY_MS;
        delete record.jobId;
        await putUploadRecord(record);
        updateTransfer(record.id, {
          status: err.message || String(err),
          error: true,
          speed: 0,
          cancelable: true,
        });
        toast(`${t("uploadFailed")}: ${record.fileName}`);
      }
    }
  } finally {
    state.uploadProcessing = false;
  }
}

function scheduleUploadQueue(delayMs = 0) {
  if (state.uploadQueueSuppressed) return;
  if (state.uploadRetryTimer) {
    clearTimeout(state.uploadRetryTimer);
  }
  state.uploadRetryTimer = setTimeout(() => {
    state.uploadRetryTimer = null;
    void processUploadQueue().catch(showError);
  }, delayMs);
}

function toast(message, opts = {}) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.toggle("toast-error", Boolean(opts.error));
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.classList.remove("show");
    el.classList.remove("toast-error");
  }, 2800);
}

function openTextModal({ title, label, description = "", value = "", required = true }) {
  return new Promise((resolve) => {
    const backdrop = $("#modalBackdrop");
    const form = $("#inputModal");
    const inputWrap = $("#modalInputWrap");
    const input = $("#modalInput");
    const desc = $("#modalDescription");
    const cleanup = () => {
      backdrop.classList.add("hidden");
      form.onsubmit = null;
      $("#modalCancelButton").onclick = null;
      $("#modalCloseButton").onclick = null;
      backdrop.onclick = null;
      document.onkeydown = null;
    };
    const close = (result) => {
      cleanup();
      resolve(result);
    };

    $("#modalTitle").textContent = title;
    $("#modalLabel").textContent = label;
    desc.textContent = description;
    desc.style.display = description ? "block" : "none";
    inputWrap.style.display = "grid";
    input.required = required;
    input.value = value;
    input.type = "text";
    backdrop.classList.remove("hidden");

    form.onsubmit = (event) => {
      event.preventDefault();
      const next = input.value.trim();
      if (required && !next) {
        toast(t("inputRequired"));
        input.focus();
        return;
      }
      close(next);
    };
    $("#modalCancelButton").onclick = () => close(null);
    $("#modalCloseButton").onclick = () => close(null);
    backdrop.onclick = (event) => {
      if (event.target === backdrop) close(null);
    };
    document.onkeydown = (event) => {
      if (event.key === "Escape") close(null);
    };
    setTimeout(() => input.focus(), 0);
  });
}

function openConfirmModal({ title, description }) {
  return new Promise((resolve) => {
    const backdrop = $("#modalBackdrop");
    const form = $("#inputModal");
    const inputWrap = $("#modalInputWrap");
    const desc = $("#modalDescription");
    const cleanup = () => {
      backdrop.classList.add("hidden");
      form.onsubmit = null;
      $("#modalCancelButton").onclick = null;
      $("#modalCloseButton").onclick = null;
      backdrop.onclick = null;
      document.onkeydown = null;
      inputWrap.style.display = "grid";
    };
    const close = (result) => {
      cleanup();
      resolve(result);
    };

    $("#modalTitle").textContent = title;
    desc.textContent = description;
    desc.style.display = description ? "block" : "none";
    inputWrap.style.display = "none";
    backdrop.classList.remove("hidden");

    form.onsubmit = (event) => {
      event.preventDefault();
      close(true);
    };
    $("#modalCancelButton").onclick = () => close(false);
    $("#modalCloseButton").onclick = () => close(false);
    backdrop.onclick = (event) => {
      if (event.target === backdrop) close(false);
    };
    document.onkeydown = (event) => {
      if (event.key === "Escape") close(false);
    };
  });
}

function openReadOnlyInfoModal(title, text) {
  return new Promise((resolve) => {
    const backdrop = $("#modalBackdrop");
    const form = $("#inputModal");
    const inputWrap = $("#modalInputWrap");
    const desc = $("#modalDescription");
    const submitBtn = $("#modalSubmitButton");
    const cancelBtn = $("#modalCancelButton");
    const cleanup = () => {
      backdrop.classList.add("hidden");
      form.onsubmit = null;
      cancelBtn.onclick = null;
      $("#modalCloseButton").onclick = null;
      backdrop.onclick = null;
      document.onkeydown = null;
      desc.textContent = "";
      desc.style.display = "";
      desc.style.whiteSpace = "";
      desc.style.maxHeight = "";
      desc.style.overflow = "";
      desc.classList.remove("modal-readonly-body");
      inputWrap.style.display = "grid";
      cancelBtn.style.display = "";
      submitBtn.textContent = t("confirm");
    };
    const close = () => {
      cleanup();
      resolve();
    };

    $("#modalTitle").textContent = title;
    inputWrap.style.display = "none";
    cancelBtn.style.display = "none";
    desc.textContent = text;
    desc.style.display = "block";
    desc.style.whiteSpace = "pre-wrap";
    desc.style.maxHeight = "min(60vh, 520px)";
    desc.style.overflow = "auto";
    desc.classList.add("modal-readonly-body");
    submitBtn.textContent = t("confirm");

    backdrop.classList.remove("hidden");
    form.onsubmit = (event) => {
      event.preventDefault();
      close();
    };
    $("#modalCloseButton").onclick = () => close();
    backdrop.onclick = (event) => {
      if (event.target === backdrop) close();
    };
    document.onkeydown = (event) => {
      if (event.key === "Escape") close();
    };
  });
}

function openChoiceModal({ title, description, primaryLabel, secondaryLabel }) {
  return new Promise((resolve) => {
    const backdrop = $("#choiceBackdrop");
    const form = $("#choiceModal");
    const cleanup = () => {
      backdrop.classList.add("hidden");
      form.onsubmit = null;
      $("#choiceSecondaryButton").onclick = null;
      $("#choiceCloseButton").onclick = null;
      backdrop.onclick = null;
      document.onkeydown = null;
    };
    const close = (result) => {
      cleanup();
      resolve(result);
    };
    $("#choiceTitle").textContent = title;
    $("#choiceDescription").textContent = description;
    $("#choicePrimaryButton").textContent = primaryLabel;
    $("#choiceSecondaryButton").textContent = secondaryLabel;
    backdrop.classList.remove("hidden");
    form.onsubmit = (event) => {
      event.preventDefault();
      close("primary");
    };
    $("#choiceSecondaryButton").onclick = () => close("secondary");
    $("#choiceCloseButton").onclick = () => close(null);
    backdrop.onclick = (event) => {
      if (event.target === backdrop) close(null);
    };
    document.onkeydown = (event) => {
      if (event.key === "Escape") close(null);
    };
  });
}

function folderPickerPathText(path) {
  const parts = path.slice(1).map((crumb) => crumb.name);
  return parts.length ? parts.join(" / ") : t("root");
}

function openFolderPicker({ title = t("chooseFolder") } = {}) {
  return new Promise((resolve) => {
    const backdrop = $("#folderPickerBackdrop");
    const form = $("#folderPickerModal");
    const list = $("#folderPickerList");
    const pathEl = $("#folderPickerPath");
    const selectButton = $("#folderPickerSelectButton");
    let closed = false;
    const path = [{ id: ROOT, name: "root" }];

    const cleanup = () => {
      backdrop.classList.add("hidden");
      form.onsubmit = null;
      $("#folderPickerCancelButton").onclick = null;
      $("#folderPickerCloseButton").onclick = null;
      backdrop.onclick = null;
      document.onkeydown = null;
    };
    const close = (result) => {
      if (closed) return;
      closed = true;
      cleanup();
      resolve(result);
    };
    const renderFolder = async () => {
      const current = path[path.length - 1];
      pathEl.textContent = folderPickerPathText(path);
      selectButton.textContent = t("chooseThisFolder");
      list.innerHTML = `<div class="empty">${escapeHtml(t("processing"))}</div>`;
      try {
        const data = await api(`/folders/${encodeURIComponent(current.id)}/contents?folderLimit=500&fileLimit=1`);
        if (closed) return;
        list.innerHTML = "";
        if (path.length > 1) {
          const parent = path[path.length - 2];
          const up = document.createElement("button");
          up.type = "button";
          up.className = "folder-picker-item";
          up.textContent = `${t("parentFolder")} ${parent.name === "root" ? t("root") : parent.name}`;
          up.addEventListener("click", () => {
            path.pop();
            void renderFolder();
          });
          list.appendChild(up);
        }
        const folders = data.folders || [];
        if (!folders.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = t("noSubfolders");
          list.appendChild(empty);
        }
        folders.forEach((folder) => {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "folder-picker-item";
          row.innerHTML = `<span class="folder-picker-icon">/</span><strong></strong>`;
          row.querySelector("strong").textContent = folder.name;
          row.addEventListener("click", () => {
            path.push({ id: folder.id, name: folder.name });
            void renderFolder();
          });
          list.appendChild(row);
        });
      } catch (err) {
        if (!closed) {
          list.innerHTML = `<div class="empty">${escapeHtml(err.message || String(err))}</div>`;
        }
      }
    };

    $("#folderPickerTitle").textContent = title;
    $("#folderPickerCancelButton").textContent = t("cancel");
    form.onsubmit = (event) => {
      event.preventDefault();
      close(path[path.length - 1].id);
    };
    $("#folderPickerCancelButton").onclick = () => close(null);
    $("#folderPickerCloseButton").onclick = () => close(null);
    backdrop.onclick = (event) => {
      if (event.target === backdrop) close(null);
    };
    document.onkeydown = (event) => {
      if (event.key === "Escape") close(null);
    };

    backdrop.classList.remove("hidden");
    void renderFolder();
  });
}

async function api(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  headers["X-Auth-Mode"] = "app";
  if (state.authToken) {
    headers.Authorization = `Basic ${state.authToken}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });
  if (res.status === 401) {
    await forceReauth();
    if (!options._retriedAuth) {
      return api(path, { ...options, _retriedAuth: true });
    }
  }
  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err.message ? `: ${Array.isArray(err.message) ? err.message.join(", ") : err.message}` : "";
    } catch {
      detail = `: ${res.statusText}`;
    }
    throw new Error(`${res.status}${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function clearAuth() {
  state.authToken = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.cookie = "tg_drive_auth=; Path=/; Max-Age=0; SameSite=Lax";
  objectUrlCache.forEach((url) => URL.revokeObjectURL(url));
  objectUrlCache.clear();
  if ("caches" in window) {
    void caches.delete(PREVIEW_CACHE_NAME);
  }
}

async function forceReauth() {
  clearAuth();
  hideContextMenu();
  closeFilePreview();
  const path = `${location.pathname}${location.search}${location.hash}`;
  const next = encodeURIComponent(path || "/");
  window.location.assign(`/login.html?next=${next}`);
  throw new Error("NEEDS_LOGIN");
}

function persistAuthCookie() {
  if (!state.authToken) return;
  document.cookie = `tg_drive_auth=${encodeURIComponent(state.authToken)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function ensureAuth() {
  if (state.authToken) return Promise.resolve(state.authToken);
  const path = `${location.pathname}${location.search}${location.hash}`;
  const next = encodeURIComponent(path || "/");
  window.location.assign(`/login.html?next=${next}`);
  return Promise.reject(new Error("NEEDS_LOGIN"));
}

async function verifyAuthToken(token) {
  const res = await fetch(`${API}/auth/verify`, {
    headers: {
      Authorization: `Basic ${token}`,
      "X-Auth-Mode": "app",
    },
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({}));
  applyAppConfig(data);
  return true;
}

function applyAppConfig(data) {
  const limit = Number(data?.maxUploadBytes);
  if (Number.isFinite(limit) && limit > 0) {
    state.maxUploadBytes = limit;
  }
  if (data?.username) {
    state.accountProfile = {
      id: data.id,
      username: data.username,
      role: data.role,
      rootFolderId: data.rootFolderId,
      maxUploadBytes: data.maxUploadBytes,
      minioLimitBytes: Number(data.minioLimitBytes || 0),
      telegramUsePlatformDefaults: data.telegramUsePlatformDefaults !== false,
      telegramStorageChatId: data.telegramStorageChatId ?? "",
      hasTelegramBotToken: Boolean(data.hasTelegramBotToken),
      isPrimaryAdmin: Boolean(data.isPrimaryAdmin),
    };
  }
  renderSettingsSelf();
  syncAdminOnlyNavVisibility();
  syncSidebarMinioQuotaVisibility();
  if (!accountIsAdmin() && isAdminOnlyView(state.view)) {
    state.view = "drive";
  }
}

function syncSidebarMinioQuotaVisibility() {
  const el = $("#sidebarMinioQuotaSection");
  if (!el) return;
  /** Admin luôn xem block MinIO; user chỉ khi đã được cấp quota (> 0 từ /auth/verify). */
  const lim = Number(state.accountProfile?.minioLimitBytes ?? 0);
  el.hidden = !(accountIsAdmin() || lim > 0);
}

/** Queue lỗi + Admin/API chỉ cho role admin (đồng bộ với backend RolesGuard). */
function syncAdminOnlyNavVisibility() {
  const show = accountIsAdmin();
  $$(
    '.nav-item[data-view="queue"], .nav-item[data-view="admin"], .nav-item[data-view="accounts"]',
  ).forEach((btn) => {
    btn.hidden = !show;
    btn.setAttribute("aria-hidden", show ? "false" : "true");
  });
}

async function loadAppConfig() {
  const data = await api("/auth/verify");
  applyAppConfig(data);
}

async function logout() {
  localStorage.removeItem(NAV_STORAGE_KEY);
  await clearPendingUploads();
  clearAuth();
  window.location.replace("/login.html");
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  $$("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  $$("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  const langToggle = $("#langToggle");
  langToggle.textContent = state.lang === "vi" ? "🇻🇳" : "🇬🇧";
  langToggle.title = state.lang === "vi" ? "Tiếng Việt" : "English";
  syncViewToggle();
  renderBreadcrumbs();
  syncSelectionModeUi();
  renderSettingsSelf();
  syncAdminOnlyNavVisibility();
  syncSidebarMinioQuotaVisibility();
  if (state.view === "admin" && accountIsAdmin()) {
    setAdminSettingsTab(state.adminSettingsTab || "config");
    void loadRuntimeSettingsAdmin().catch(showError);
  }
  if (state.view === "accounts" && accountIsAdmin()) {
    void loadAdminAccountsView().catch(showError);
  }
}

function setView(view, opts = {}) {
  if (!["drive", "images", "trash", "queue", "settings", "accounts", "admin"].includes(view)) {
    view = "drive";
  }
  if (!accountIsAdmin() && isAdminOnlyView(view)) {
    view = "drive";
  }
  state.view = view;
  $$(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  ["drive", "images", "trash", "queue", "settings", "accounts", "admin"].forEach((name) => {
    $(`#${name}View`)?.classList.toggle("hidden", name !== view);
  });
  if (!isFileBrowserView(view)) {
    exitSelectionMode();
  }
  syncTouchChrome();
  if (opts.persist !== false) {
    persistNavigationState();
  }
  if (opts.load !== false) {
    if (view === "images") void loadImages().catch(showError);
    if (view === "trash") void loadTrash();
    if (view === "queue") void loadQueue();
    if (view === "settings") void loadSettingsView().catch(showError);
    if (view === "admin" && accountIsAdmin()) {
      setAdminSettingsTab(state.adminSettingsTab || "config");
      void loadRuntimeSettingsAdmin().catch(showError);
    }
    if (view === "accounts" && accountIsAdmin()) {
      void loadAdminAccountsView().catch(showError);
    }
  }
}

function parseHashNavigation() {
  const raw = location.hash.replace(/^#\/?/, "");
  if (!raw) return null;
  const [pathPart, queryPart = ""] = raw.split("?");
  const [view = "drive", folderId] = pathPart.split("/").map(decodeURIComponent);
  return {
    view,
    folderId,
    search: Object.fromEntries(new URLSearchParams(queryPart).entries()),
  };
}

function currentSearchSnapshot() {
  const form = $("#searchForm");
  if (!form) return {};
  return Object.fromEntries(
    Array.from(new FormData(form).entries())
      .map(([key, value]) => [key, String(value).trim()])
      .filter(([, value]) => value),
  );
}

function applySearchSnapshot(search = {}, advancedOpen = false) {
  const form = $("#searchForm");
  if (!form) return;
  form.reset();
  Object.entries(search).forEach(([key, value]) => {
    if (key in form) {
      form[key].value = value;
    }
  });
  $("#advancedSearchFields").classList.toggle("hidden", !advancedOpen);
  $("#searchAdvancedToggle").setAttribute("aria-expanded", String(advancedOpen));
}

function restoreNavigationState() {
  const saved = parseStoredJson(NAV_STORAGE_KEY) || {};
  const fromHash = parseHashNavigation();
  const source = { ...saved, ...(fromHash || {}) };
  if (["drive", "images", "trash", "queue", "settings", "accounts", "admin"].includes(source.view)) {
    state.view = source.view;
  }
  if (source.folderId) {
    state.folderId = source.folderId;
  }
  if (Array.isArray(saved.path) && saved.path.length) {
    state.path = saved.path;
  }
  if (state.folderId !== ROOT && !state.path.some((crumb) => crumb.id === state.folderId)) {
    state.path.push({ id: state.folderId, name: state.folderId });
  }
  normalizePath();
  const search = { ...(saved.search || {}), ...((fromHash && fromHash.search) || {}) };
  const hasSearch = Object.keys(search).length > 0;
  applySearchSnapshot(search, Boolean(saved.advancedOpen));
  state.searchActive = state.view === "drive" && Boolean(saved.searchActive || hasSearch);
  setDriveSearchActive(state.searchActive, { persist: false });
}

function persistNavigationState() {
  normalizePath();
  const search = currentSearchSnapshot();
  const nav = {
    view: !accountIsAdmin() && isAdminOnlyView(state.view) ? "drive" : state.view,
    folderId: state.folderId,
    path: state.path,
    searchActive: state.searchActive,
    search,
    advancedOpen: isAdvancedSearchOpen(),
  };
  localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(nav));

  const hashParams = new URLSearchParams();
  if (state.searchActive) {
    Object.entries(search).forEach(([key, value]) => hashParams.set(key, value));
  }
  const baseHash =
    state.view === "drive"
      ? `/drive/${encodeURIComponent(state.folderId)}`
      : `/${encodeURIComponent(state.view)}`;
  const nextHash = `#${baseHash}${hashParams.toString() ? `?${hashParams.toString()}` : ""}`;
  if (location.hash !== nextHash) {
    history.replaceState(null, "", `${location.pathname}${location.search}${nextHash}`);
  }
}

function renderBreadcrumbs() {
  const el = $("#breadcrumbs");
  el.innerHTML = "";
  normalizePath();
  $("#backFolderButton").disabled = state.path.length <= 1;
  state.path.forEach((crumb, index) => {
    if (index > 0) {
      const sep = document.createElement("span");
      sep.className = "crumb-separator";
      sep.textContent = "›";
      el.appendChild(sep);
    }
    const btn = document.createElement("button");
    btn.className = "crumb";
    btn.textContent = index === 0 ? t("root") : crumb.name;
    makeDropTarget(btn, crumb.id);
    btn.addEventListener("click", () => {
      state.path = state.path.slice(0, index + 1);
      void navigateToFolder(crumb.id);
    });
    el.appendChild(btn);
  });
}

async function goBackFolder() {
  normalizePath();
  if (state.path.length <= 1) return;
  state.path.pop();
  const prev = state.path[state.path.length - 1];
  await navigateToFolder(prev.id);
}

function normalizePath() {
  const seen = new Set();
  state.path = state.path.filter((crumb, index) => {
    if (index === 0) return crumb.id === ROOT;
    if (seen.has(crumb.id)) return false;
    seen.add(crumb.id);
    return true;
  });
  if (!state.path.length || state.path[0].id !== ROOT) {
    state.path.unshift({ id: ROOT, name: "root" });
  }
}

async function navigateToFolder(folderId, folderName) {
  if (state.loadingFolderId === folderId || state.folderId === folderId) {
    persistNavigationState();
    return;
  }
  state.loadingFolderId = folderId;
  try {
    clearDriveSearch({ persist: false });
    exitSelectionMode();
    state.folderId = folderId;
    if (folderName) {
      const existingIndex = state.path.findIndex((crumb) => crumb.id === folderId);
      if (existingIndex >= 0) {
        state.path = state.path.slice(0, existingIndex + 1);
      } else {
        state.path.push({ id: folderId, name: folderName });
      }
    }
    await loadDrive();
    persistNavigationState();
  } finally {
    state.loadingFolderId = null;
  }
}

function emptyNode() {
  const el = document.createElement("div");
  el.className = "empty";
  el.textContent = t("empty");
  return el;
}

function syncProcessingFolders() {
  $$(".folder-card[data-folder-id]").forEach((card) => {
    const isProcessing = state.processingFolderIds.has(card.dataset.folderId);
    card.classList.toggle("processing", isProcessing);
    card.toggleAttribute("aria-busy", isProcessing);
    card.dataset.processingLabel = t("processing");
    card.disabled = isProcessing;
  });
}

async function withFolderProcessing(folderIds, task) {
  const ids = Array.from(new Set(folderIds.filter(Boolean)));
  ids.forEach((id) => state.processingFolderIds.add(id));
  syncProcessingFolders();
  try {
    return await task();
  } finally {
    ids.forEach((id) => state.processingFolderIds.delete(id));
    syncProcessingFolders();
  }
}

function renderFolders(folders) {
  const grid = $("#folderGrid");
  state.driveFolders = folders;
  state.visibleFolders = folders;
  pruneSelectedFolders(folders);
  grid.innerHTML = "";
  if (!folders.length) {
    syncSelectionBar();
    return;
  }
  folders.forEach((folder) => {
    const btn = document.createElement("button");
    btn.className = "folder-card";
    btn.dataset.folderId = folder.id;
    btn.classList.toggle("selected", state.selectedFolderIds.has(folder.id));
    btn.classList.toggle("processing", state.processingFolderIds.has(folder.id));
    btn.toggleAttribute("aria-busy", state.processingFolderIds.has(folder.id));
    btn.dataset.processingLabel = t("processing");
    btn.disabled = state.processingFolderIds.has(folder.id);
    btn.draggable = true;
    btn.innerHTML = `<img class="folder-icon" src="/folder.png" alt="" /><strong></strong>`;
    btn.querySelector("strong").textContent = folder.name;
    setInternalDrag(btn, { type: "folder", id: folder.id, name: folder.name });
    makeDropTarget(btn, folder.id);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      if (touchBulkSelectActive()) {
        toggleTouchItemSelection("folder", folder.id);
        return;
      }
      if (isTouchLikePointer()) {
        void navigateToFolder(folder.id, folder.name).catch(showError);
        return;
      }
      toggleFolderSelection(folder.id, event);
    });
    btn.addEventListener("dblclick", () => {
      state.selectedFolderIds.add(folder.id);
      syncSelectedRows();
      syncSelectionBar();
      void navigateToFolder(folder.id, folder.name);
    });
    attachContextMenu(btn, btn, () => contextMenuItemsForItem("folder", folder));
    grid.appendChild(btn);
  });
  syncSelectionBar();
}

function itemContextMenuItems(type, item) {
  if (type === "folder") {
    return [
      { label: t("open"), handler: () => navigateToFolder(item.id, item.name) },
      { separator: true },
      { label: t("downloadZip"), handler: () => downloadFolderZip(item.id) },
      { label: t("copyFolder"), handler: () => copyFolder(item.id) },
      { label: t("move"), handler: () => moveFolder(item) },
      { label: t("info"), handler: () => showItemInfo("folder", item) },
      { separator: true },
      {
        label: t("delete"),
        variant: "danger",
        handler: () => deleteFolder(item.id, item.name),
      },
    ];
  }
  return [
    { label: t("open"), handler: () => openFilePreview(item) },
    { label: t("download"), handler: () => downloadFile(item) },
    { label: t("share"), handler: () => createShare(item.id) },
    { label: t("tags"), handler: () => editTags(item) },
    { label: t("rename"), handler: () => renameFile(item) },
    { label: t("move"), handler: () => moveFile(item) },
    { label: t("info"), handler: () => showItemInfo("file", item) },
    ...(item.thumbnailTelegramFileId
      ? [{ label: t("thumb"), handler: () => openThumbnailPreview(item) }]
      : []),
    { separator: true },
    {
      label: t("delete"),
      variant: "danger",
      handler: async () => {
        await api(`/files/${item.id}`, { method: "DELETE" });
        toast(t("deleted"));
        await Promise.all([refreshAfterFilePatch(), loadQuota()]);
      },
    },
  ];
}

function fileIcon(file) {
  if (file.mimeType?.startsWith("image/")) return "◩";
  if (file.mimeType === "application/pdf") return "PDF";
  if (file.mimeType?.startsWith("video/")) return "▶";
  return "◆";
}

async function loadThumbnail(container, file, mode) {
  if (!container || !file.thumbnailTelegramFileId) {
    return;
  }
  try {
    const img = document.createElement("img");
    img.alt = file.name;
    img.loading = "lazy";
    img.className = "loading";
    img.onload = () => img.classList.remove("loading");
    img.onerror = async () => {
      try {
        img.src = await objectUrlWithAuth(fileThumbnailUrl(file), { cache: true });
      } catch {
        container.textContent = fileIcon(file);
      }
    };
    img.src = fileThumbnailUrl(file);
    container.textContent = "";
    container.appendChild(img);
  } catch {
    /* Keep fallback icon when thumbnail cannot be loaded. */
  }
}

function syncViewToggle() {
  const btn = $("#viewToggleButton");
  if (!btn) return;
  btn.textContent = state.fileView === "grid" ? t("listView") : t("gridView");
}

function toggleFileView() {
  if (state.view === "images") {
    void loadImages().catch(showError);
    return;
  }
  state.fileView = state.fileView === "grid" ? "list" : "grid";
  localStorage.setItem(VIEW_STORAGE_KEY, state.fileView);
  syncViewToggle();
  if (state.searchActive) {
    $("#searchForm").requestSubmit();
  } else {
    void loadDrive().catch(showError);
  }
}

function pruneSelectedFolders(folders) {
  const visibleIds = new Set(folders.map((folder) => folder.id));
  for (const id of state.selectedFolderIds) {
    if (!visibleIds.has(id)) state.selectedFolderIds.delete(id);
  }
}

function pruneSelectedFiles(files) {
  const visibleIds = new Set(files.map((file) => file.id));
  for (const id of state.selectedFileIds) {
    if (!visibleIds.has(id)) state.selectedFileIds.delete(id);
  }
}

function selectSingleItem(type, id) {
  state.selectedFolderIds.clear();
  state.selectedFileIds.clear();
  state.selectionAnchor = { type, id };
  if (type === "folder") {
    state.selectedFolderIds.add(id);
  } else {
    state.selectedFileIds.add(id);
  }
  syncSelectedRows();
  syncSelectionBar();
}

function visibleSelectionItems() {
  return [
    ...state.visibleFolders.map((folder) => ({ type: "folder", id: folder.id })),
    ...state.visibleFiles.map((file) => ({ type: "file", id: file.id })),
  ];
}

function sameSelectionItem(a, b) {
  return a?.type === b?.type && a?.id === b?.id;
}

function selectRangeTo(type, id) {
  const items = visibleSelectionItems();
  const current = { type, id };
  const anchor = state.selectionAnchor && items.some((item) => sameSelectionItem(item, state.selectionAnchor))
    ? state.selectionAnchor
    : current;
  const start = items.findIndex((item) => sameSelectionItem(item, anchor));
  const end = items.findIndex((item) => sameSelectionItem(item, current));
  if (start < 0 || end < 0) {
    selectSingleItem(type, id);
    return;
  }
  const [from, to] = start <= end ? [start, end] : [end, start];
  state.selectedFolderIds.clear();
  state.selectedFileIds.clear();
  items.slice(from, to + 1).forEach((item) => {
    if (item.type === "folder") {
      state.selectedFolderIds.add(item.id);
    } else {
      state.selectedFileIds.add(item.id);
    }
  });
  syncSelectedRows();
  syncSelectionBar();
}

function toggleFolderSelection(folderId, event) {
  if (event?.shiftKey) {
    selectRangeTo("folder", folderId);
    return;
  }
  if (!isToggleSelectEvent(event)) {
    selectSingleItem("folder", folderId);
    return;
  }
  state.selectionAnchor = { type: "folder", id: folderId };
  if (state.selectedFolderIds.has(folderId)) {
    state.selectedFolderIds.delete(folderId);
  } else {
    state.selectedFolderIds.add(folderId);
  }
  syncSelectedRows();
  syncSelectionBar();
}

function toggleFileSelection(fileId, event) {
  if (event?.shiftKey) {
    selectRangeTo("file", fileId);
    return;
  }
  if (!isToggleSelectEvent(event)) {
    selectSingleItem("file", fileId);
    return;
  }
  state.selectionAnchor = { type: "file", id: fileId };
  if (state.selectedFileIds.has(fileId)) {
    state.selectedFileIds.delete(fileId);
  } else {
    state.selectedFileIds.add(fileId);
  }
  syncSelectedRows();
  syncSelectionBar();
}

function isToggleSelectEvent(event) {
  return Boolean(event?.ctrlKey || event?.metaKey);
}

function clearFileSelection() {
  state.selectedFolderIds.clear();
  state.selectedFileIds.clear();
  state.selectionAnchor = null;
  syncSelectedRows();
  syncSelectionBar();
}

function touchBulkSelectActive() {
  return Boolean(state.selectionMode && !isDesktopFinePointer());
}

function toggleTouchItemSelection(type, id) {
  if (type === "folder") {
    state.selectionAnchor = { type: "folder", id };
    if (state.selectedFolderIds.has(id)) {
      state.selectedFolderIds.delete(id);
    } else {
      state.selectedFolderIds.add(id);
    }
  } else {
    state.selectionAnchor = { type: "file", id };
    if (state.selectedFileIds.has(id)) {
      state.selectedFileIds.delete(id);
    } else {
      state.selectedFileIds.add(id);
    }
  }
  syncSelectedRows();
  syncSelectionBar();
}

function exitSelectionMode() {
  state.selectionMode = false;
  clearFileSelection();
  syncSelectionModeUi();
}

function syncSelectionModeUi() {
  $(".app-shell")?.classList.toggle(
    "drive-selection-mode",
    Boolean(state.selectionMode && !isDesktopFinePointer() && isFileBrowserView()),
  );
  for (const toggleBtn of [$("#selectModeToggle"), $("#imagesSelectModeToggle")]) {
    if (!toggleBtn || isDesktopFinePointer()) continue;
    toggleBtn.textContent = state.selectionMode ? t("selectModeDone") : t("selectMode");
    toggleBtn.classList.toggle("active", state.selectionMode);
    toggleBtn.setAttribute("aria-pressed", String(state.selectionMode));
  }
}

function syncTouchChrome() {
  const show = Boolean(isFileBrowserView() && !isDesktopFinePointer());
  for (const toggleBtn of [$("#selectModeToggle"), $("#imagesSelectModeToggle")]) {
    if (!toggleBtn) continue;
    toggleBtn.classList.toggle("hidden", !show);
  }
  if (!show && state.selectionMode) {
    state.selectionMode = false;
    clearFileSelection();
  }
  syncSelectionModeUi();
}

function selectedItemCount() {
  return state.selectedFolderIds.size + state.selectedFileIds.size;
}

function syncSelectedRows() {
  $$(".folder-card[data-folder-id]").forEach((row) => {
    row.classList.toggle("selected", state.selectedFolderIds.has(row.dataset.folderId));
  });
  $$(".file-row[data-file-id]").forEach((row) => {
    row.classList.toggle("selected", state.selectedFileIds.has(row.dataset.fileId));
  });
}

function syncSelectionBar() {
  const count = selectedItemCount();
  const touchBulk = touchBulkSelectActive();
  const hidden = count < (touchBulk ? 1 : 2);
  const countText = `${count} ${t("selectedItems")}`;
  for (const [barId, countId] of [
    ["selectionBar", "selectionCount"],
    ["imagesSelectionBar", "imagesSelectionCount"],
  ]) {
    const bar = $(`#${barId}`);
    if (!bar) continue;
    bar.classList.toggle("hidden", hidden);
    const countEl = $(`#${countId}`);
    if (countEl) countEl.textContent = countText;
  }
}

function selectedVisibleFolders() {
  return state.visibleFolders.filter((folder) => state.selectedFolderIds.has(folder.id));
}

function selectedVisibleFiles() {
  return state.visibleFiles.filter((file) => state.selectedFileIds.has(file.id));
}

function contextMenuItemsForItem(type, item) {
  const count = selectedItemCount();
  const selected =
    type === "folder"
      ? state.selectedFolderIds.has(item.id)
      : state.selectedFileIds.has(item.id);
  if (count > 1 && selected) {
    return selectionMenuItems();
  }
  return itemContextMenuItems(type, item);
}

function selectionMenuItems() {
  return [
    { label: t("moveSelected"), handler: () => moveSelectedFiles() },
    {
      label: t("deleteSelected"),
      variant: "danger",
      handler: () => deleteSelectedFiles(),
    },
  ];
}

function renderFileList(target, files, mode = "drive") {
  const list = typeof target === "string" ? $(target) : target;
  if (mode === "drive") {
    state.driveFiles = files;
  }
  if (mode === "images") {
    state.imagesFiles = files;
  }
  if (mode === "trash" || mode === "images" || (mode !== "drive" || !state.searchActive)) {
    state.visibleFiles = files;
  }
  if (mode !== "trash" && (mode === "images" || mode !== "drive" || !state.searchActive)) {
    pruneSelectedFiles(files);
  }
  list.innerHTML = "";
  const forceGrid = mode === "images";
  list.classList.toggle("grid-view", forceGrid || state.fileView === "grid");
  list.classList.toggle("list-view", !forceGrid && state.fileView !== "grid");
  if (!files.length) {
    list.appendChild(emptyNode());
    syncSelectionBar();
    return;
  }

  files.forEach((file) => {
    const row = document.createElement("article");
    row.className = "file-row";
    row.dataset.fileId = file.id;
    row.classList.toggle("selected", state.selectedFileIds.has(file.id));
    row.draggable = true;
    setInternalDrag(row, { type: "file", id: file.id, name: file.name });
    row.addEventListener("click", (event) => {
      if (event.target.closest(".row-actions")) return;
      if (touchBulkSelectActive() && mode !== "trash") {
        toggleTouchItemSelection("file", file.id);
        return;
      }
      if (isTouchLikePointer()) {
        void openFilePreview(file).catch(showError);
        return;
      }
      if (mode !== "trash") {
        toggleFileSelection(file.id, event);
      }
    });
    row.addEventListener("dblclick", (event) => {
      if (event.target.closest(".row-actions")) return;
      event.preventDefault();
      event.stopPropagation();
      if (mode !== "trash") {
        state.selectedFileIds.add(file.id);
        syncSelectedRows();
        syncSelectionBar();
      }
      void openFilePreview(file).catch(showError);
    });
    const tags = (file.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    const uploadedAt = formatUploadedAt(file.createdAt);
    const cardMeta = [formatBytes(file.size), uploadedAt].filter(Boolean).join(" · ");
    const displayName = compactFileNameForMobile(file.name);
    row.innerHTML = `
      <div class="file-main">
        <span class="file-thumb" data-file-id="${escapeHtml(file.id)}">${fileIcon(file)}</span>
        <div class="file-title">
          <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(displayName)}</div>
          <div class="file-tags">${tags}</div>
          <div class="file-card-meta">${escapeHtml(cardMeta)}</div>
        </div>
      </div>
      <div class="muted">${escapeHtml(file.mimeType || "")}</div>
      <div class="muted">${formatBytes(file.size)}</div>
      <div class="row-actions"><button class="small-action" type="button">⋮</button></div>
    `;
    loadThumbnail(row.querySelector(".file-thumb"), file, mode);
    const menuButton = row.querySelector(".row-actions .small-action");

    if (mode === "trash") {
      const items = [
        { label: t("open"), handler: () => openFilePreview(file) },
        { label: t("download"), handler: () => downloadFile(file) },
        { label: t("info"), handler: () => showItemInfo("file", file) },
        ...(file.thumbnailTelegramFileId
          ? [{ label: t("thumb"), handler: () => openThumbnailPreview(file) }]
          : []),
      ];
      if (file.deletedAt) {
        items.push(
          {
            label: t("restore"),
            variant: "success",
            handler: async () => {
              await api(`/files/trash/${file.id}/restore?duplicatePolicy=suffix`, { method: "POST" });
              toast(t("restored"));
              await Promise.all([loadTrash(), loadQuota()]);
            },
          },
          {
            label: t("permanentDelete"),
            variant: "danger",
            handler: async () => {
              await api(`/files/trash/${file.id}`, { method: "DELETE" });
              toast(t("deleted"));
              await Promise.all([loadTrash(), loadQuota()]);
            },
          },
        );
      }
      attachContextMenu(row, menuButton, items);
    } else {
      attachContextMenu(row, menuButton, () => contextMenuItemsForItem("file", file));
    }
    list.appendChild(row);
  });
  syncSelectionBar();
}

function isTouchLikePointer() {
  return window.matchMedia?.("(hover: none), (pointer: coarse)").matches ?? false;
}

/** Chuột chuẩn trên desktop — ẩn UI chọn-nhiều-cảm-ứng. */
function isDesktopFinePointer() {
  return window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;
}

function compactFileNameForMobile(name) {
  const value = String(name || "");
  if (!isTouchLikePointer() || value.length <= 28) return value;
  const dot = value.lastIndexOf(".");
  const ext = dot > 0 && value.length - dot <= 8 ? value.slice(dot) : "";
  const headLength = ext ? 22 - ext.length : 25;
  return `${value.slice(0, Math.max(10, headLength))}...${ext}`;
}

function attachContextMenu(row, menuButton, items) {
  const open = (event) => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, typeof items === "function" ? items() : items);
  };
  row.addEventListener("contextmenu", open);
  if (!menuButton || menuButton === row) {
    return;
  }
  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const rect = menuButton.getBoundingClientRect();
    showContextMenu(rect.left, rect.bottom + 6, typeof items === "function" ? items() : items);
  });
}

function showContextMenu(x, y, items) {
  const menu = $("#contextMenu");
  menu.innerHTML = "";
  items.forEach((item) => {
    if (item.separator) {
      const divider = document.createElement("div");
      divider.className = "context-divider";
      divider.setAttribute("role", "separator");
      menu.appendChild(divider);
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `context-item ${item.variant || ""}`.trim();
    btn.textContent = item.label;
    btn.disabled = Boolean(item.disabled);
    btn.addEventListener("click", async () => {
      if (item.disabled) return;
      hideContextMenu();
      try {
        await item.handler();
      } catch (err) {
        showError(err);
      }
    });
    menu.appendChild(btn);
  });
  menu.classList.remove("hidden");
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 12);
  const top = Math.min(y, window.innerHeight - rect.height - 12);
  menu.style.left = `${Math.max(12, left)}px`;
  menu.style.top = `${Math.max(12, top)}px`;
}

function hideContextMenu() {
  $("#contextMenu").classList.add("hidden");
}

function fileAccessBase(fileOrId) {
  const fileId = typeof fileOrId === "object" ? fileOrId.id : fileOrId;
  const trashPrefix = typeof fileOrId === "object" && fileOrId.deletedAt ? "/trash" : "";
  return `/api/v1/files${trashPrefix}/${fileId}`;
}

function fileViewUrl(fileOrId) {
  return `${fileAccessBase(fileOrId)}/view?appAuth=1`;
}

function fileDownloadUrl(fileOrId) {
  return `${fileAccessBase(fileOrId)}/download?appAuth=1`;
}

function fileThumbnailUrl(fileOrId) {
  return `${fileAccessBase(fileOrId)}/thumbnail?appAuth=1`;
}

async function openFilePreview(file) {
  const previewToken = ++state.previewToken;
  state.previewIndex = state.visibleFiles.findIndex((item) => item.id === file.id);
  if (file.canDirectDownload === false) {
    showTelegramFallback(file, previewToken);
    return;
  }
  const viewUrl = fileViewUrl(file);
  const downloadUrl = fileDownloadUrl(file);
  const body = $("#viewerBody");
  $("#viewerTitle").textContent = file.name;
  $("#viewerMeta").textContent = `${file.mimeType || ""} · ${formatBytes(file.size)}`;
  $("#viewerDownloadButton").onclick = () =>
    void downloadWithAuth(downloadUrl, file.name, { knownTotalBytes: file.size }).catch(showError);
  body.innerHTML = "";
  body.className = "viewer-body";
  revealViewerBackdrop();
  syncViewerNav();

  if (file.mimeType?.startsWith("image/")) {
    body.classList.add("image-mode");
    const img = document.createElement("img");
    img.alt = file.name;
    img.className = "loading";
    img.onload = () => img.classList.remove("loading");
    img.onerror = async () => {
      try {
        const fallbackUrl = await objectUrlWithAuth(viewUrl, { cache: true });
        if (previewToken !== state.previewToken) return;
        img.src = fallbackUrl;
      } catch {
        if (previewToken === state.previewToken) showTelegramFallback(file, previewToken);
      }
    };
    if (previewToken !== state.previewToken) return;
    img.src = viewUrl;
    body.appendChild(createZoomableImagePreview(img));
    return;
  }
  if (file.mimeType?.startsWith("video/")) {
    const video = document.createElement("video");
    video.onerror = async () => {
      try {
        const fallbackUrl = await objectUrlWithAuth(viewUrl, { cache: true });
        if (previewToken !== state.previewToken) return;
        video.src = fallbackUrl;
      } catch {
        if (previewToken === state.previewToken) showTelegramFallback(file, previewToken);
      }
    };
    video.src = viewUrl;
    video.controls = true;
    video.autoplay = false;
    body.appendChild(video);
    return;
  }
  if (file.mimeType?.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.onerror = async () => {
      try {
        const fallbackUrl = await objectUrlWithAuth(viewUrl, { cache: true });
        if (previewToken !== state.previewToken) return;
        audio.src = fallbackUrl;
      } catch {
        if (previewToken === state.previewToken) showTelegramFallback(file, previewToken);
      }
    };
    audio.src = viewUrl;
    audio.controls = true;
    body.appendChild(audio);
    return;
  }
  if (file.mimeType === "application/pdf") {
    const iframe = document.createElement("iframe");
    iframe.onerror = async () => {
      try {
        const fallbackUrl = await objectUrlWithAuth(viewUrl, { cache: true });
        if (previewToken !== state.previewToken) return;
        iframe.src = fallbackUrl;
      } catch {
        if (previewToken === state.previewToken) showTelegramFallback(file, previewToken);
      }
    };
    iframe.src = viewUrl;
    body.appendChild(iframe);
    return;
  }
  if (isTextPreviewMime(file.mimeType)) {
    const pre = document.createElement("pre");
    pre.className = "text-preview";
    pre.textContent = "Loading...";
    body.appendChild(pre);
    const res = await cachedFetchWithAuth(viewUrl);
    if (previewToken !== state.previewToken) return;
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    pre.textContent = await res.text();
    return;
  }

  const unsupported = document.createElement("div");
  unsupported.className = "unsupported-preview";
  unsupported.innerHTML = `
    <strong>${escapeHtml(t("unsupportedPreview"))}</strong>
    <p>${escapeHtml(t("unsupportedPreviewHint"))}</p>
  `;
  const btn = actionButton(t("download"), "", () =>
    downloadWithAuth(downloadUrl, file.name, { knownTotalBytes: file.size }),
  );
  unsupported.appendChild(btn);
  body.appendChild(unsupported);
}

function createZoomableImagePreview(img) {
  const wrap = document.createElement("div");
  wrap.className = "image-preview";
  const stage = document.createElement("div");
  stage.className = "image-preview-stage";
  const controls = document.createElement("div");
  controls.className = "image-zoom-controls";
  const zoomOut = actionButton("-", "", () => setZoom(zoom - 0.25));
  const zoomReset = actionButton("100%", "", () => setZoom(1));
  const zoomIn = actionButton("+", "", () => setZoom(zoom + 0.25));
  controls.append(zoomOut, zoomReset, zoomIn);
  stage.appendChild(img);
  wrap.append(stage, controls);

  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pointerStart = null;
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;

  const applyZoom = () => {
    if (zoom <= 1) {
      panX = 0;
      panY = 0;
    }
    stage.classList.toggle("pannable", zoom > 1);
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    zoomReset.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= 0.5;
    zoomIn.disabled = zoom >= 5;
  };
  const setZoom = (nextZoom) => {
    zoom = Math.min(5, Math.max(0.5, Number(nextZoom) || 1));
    applyZoom();
  };
  const touchDistance = (touches) => {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  stage.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && Math.abs(event.deltaY) < 20) return;
      event.preventDefault();
      setZoom(zoom + (event.deltaY < 0 ? 0.2 : -0.2));
    },
    { passive: false },
  );
  stage.addEventListener("dblclick", () => setZoom(zoom === 1 ? 2 : 1));
  stage.addEventListener("pointerdown", (event) => {
    if (zoom <= 1 || event.pointerType === "touch") return;
    pointerStart = { x: event.clientX, y: event.clientY, panX, panY };
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!pointerStart) return;
    event.preventDefault();
    panX = pointerStart.panX + event.clientX - pointerStart.x;
    panY = pointerStart.panY + event.clientY - pointerStart.y;
    applyZoom();
  });
  stage.addEventListener("pointerup", () => {
    pointerStart = null;
  });
  stage.addEventListener("pointercancel", () => {
    pointerStart = null;
  });
  stage.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 2) {
        pinchStartDistance = touchDistance(event.touches);
        pinchStartZoom = zoom;
        pointerStart = null;
        return;
      }
      if (event.touches.length === 1 && zoom > 1) {
        const touch = event.touches[0];
        pointerStart = { x: touch.clientX, y: touch.clientY, panX, panY };
      }
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length === 2 && pinchStartDistance) {
        event.preventDefault();
        setZoom(pinchStartZoom * (touchDistance(event.touches) / pinchStartDistance));
        return;
      }
      if (event.touches.length === 1 && pointerStart && zoom > 1) {
        event.preventDefault();
        const touch = event.touches[0];
        panX = pointerStart.panX + touch.clientX - pointerStart.x;
        panY = pointerStart.panY + touch.clientY - pointerStart.y;
        applyZoom();
      }
    },
    { passive: false },
  );
  stage.addEventListener("touchend", () => {
    pointerStart = null;
    pinchStartDistance = 0;
  });
  applyZoom();
  return wrap;
}

function showTelegramFallback(file, previewToken = state.previewToken) {
  if (previewToken !== state.previewToken) return;
  const body = $("#viewerBody");
  $("#viewerTitle").textContent = file.name;
  $("#viewerMeta").textContent = `${file.mimeType || ""} · ${formatBytes(file.size)}`;
  $("#viewerDownloadButton").onclick = () => openTelegramMessage(file);
  body.innerHTML = "";
  body.className = "viewer-body";
  revealViewerBackdrop();
  syncViewerNav();
  const fallback = document.createElement("div");
  fallback.className = "unsupported-preview";
  fallback.innerHTML = `
    <strong>${escapeHtml(t("unsupportedPreview"))}</strong>
    <p>${escapeHtml(t("unsupportedPreviewHint"))}</p>
  `;
  fallback.appendChild(actionButton(t("openTelegram"), "", () => {
    openTelegramMessage(file);
  }));
  body.appendChild(fallback);
}

async function downloadFile(file) {
  if (file.canDirectDownload === false) {
    openTelegramMessage(file);
    return;
  }
  try {
    await downloadWithAuth(fileDownloadUrl(file), file.name, { knownTotalBytes: file.size });
  } catch (err) {
    if (isTransferCanceled(err)) return;
    if (file.telegramMessageUrl) {
      window.open(file.telegramMessageUrl, "_blank", "noopener");
      return;
    }
    throw err;
  }
}

function openTelegramMessage(file) {
  if (!file.telegramMessageUrl) {
    toast(t("telegramLinkMissing"));
    return false;
  }
  window.open(file.telegramMessageUrl, "_blank", "noopener");
  return true;
}

async function fetchWithAuth(url, options = {}) {
  await ensureAuth();
  const headers = options.headers ? { ...options.headers } : {};
  headers["X-Auth-Mode"] = "app";
  headers.Authorization = `Basic ${state.authToken}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    await forceReauth();
    if (!options._retriedAuth) {
      return fetchWithAuth(url, { ...options, _retriedAuth: true });
    }
  }
  return res;
}

async function cachedFetchWithAuth(url) {
  if ("caches" in window) {
    const cache = await caches.open(PREVIEW_CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) return cached.clone();
    const fresh = await fetchWithAuth(url);
    if (fresh.ok) {
      await cache.put(url, fresh.clone());
    }
    return fresh;
  }
  return fetchWithAuth(url);
}

async function objectUrlWithAuth(url, opts = {}) {
  if (opts.cache && objectUrlCache.has(url)) {
    return objectUrlCache.get(url);
  }
  const res = opts.cache ? await cachedFetchWithAuth(url) : await fetchWithAuth(url);
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  const objectUrl = URL.createObjectURL(await res.blob());
  if (opts.cache) {
    objectUrlCache.set(url, objectUrl);
  }
  return objectUrl;
}

async function downloadWithAuth(url, filename, opts = {}) {
  const transferId = createTransfer("download", filename || "download");
  const knownTotalBytes = Math.max(0, Number(opts.knownTotalBytes || 0));
  const controller = new AbortController();
  state.transferAborters.set(transferId, () => controller.abort());
  updateTransfer(transferId, {
    cancelable: true,
    total: knownTotalBytes,
    downloadUrl: url,
    knownTotalBytes,
    error: false,
  });
  try {
    const res = await fetchWithAuth(url, { signal: controller.signal });
    if (!res.ok) {
      updateTransfer(transferId, { status: `HTTP ${res.status}`, error: true, cancelable: false });
      throw new Error(`${res.status}: ${res.statusText}`);
    }
    const headerTotal = Number(res.headers.get("content-length") || 0);
    const total = Math.max(headerTotal, knownTotalBytes);
    updateTransfer(transferId, { total, status: t("downloading") });
    const reader = res.body?.getReader();
    const chunks = [];
    let loaded = 0;
    let lastLoaded = 0;
    let lastTime = performance.now();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        const speed = measureTransferSpeed(transferId, loaded, lastLoaded, lastTime);
        lastLoaded = loaded;
        lastTime = performance.now();
        updateTransfer(transferId, { loaded, total, speed, status: t("downloading") });
      }
    } else {
      chunks.push(new Uint8Array(await res.arrayBuffer()));
      loaded = chunks[0].byteLength;
      updateTransfer(transferId, { loaded, total: total || loaded, speed: 0, status: t("downloading") });
    }
    const finalTotal = total > 0 ? total : loaded;
    updateTransfer(transferId, { loaded, total: finalTotal, speed: 0, status: t("downloading") });
    const href = URL.createObjectURL(new Blob(chunks));
    const a = document.createElement("a");
    a.href = href;
    a.download = filename || "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    finishTransfer(transferId, t("done"));
    updateTransfer(transferId, { cancelable: false });
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch (err) {
    if (isTransferCanceled(err)) {
      updateTransfer(transferId, { status: t("canceled"), error: true, speed: 0, cancelable: false });
      return;
    }
    updateTransfer(transferId, {
      status: err.message || String(err),
      error: true,
      speed: 0,
      cancelable: false,
    });
    throw err;
  } finally {
    state.transferAborters.delete(transferId);
  }
}

function revealViewerBackdrop() {
  $("#viewerBackdrop").classList.remove("hidden");
  state.previewBackdropGuardUntil = performance.now() + 480;
}

function closeFilePreview() {
  state.previewBackdropGuardUntil = 0;
  state.previewToken++;
  $("#viewerBackdrop").classList.add("hidden");
  const body = $("#viewerBody");
  body.innerHTML = "";
  body.className = "viewer-body";
  state.previewIndex = -1;
}

function syncViewerNav() {
  $("#viewerPrevButton").disabled = state.previewIndex <= 0;
  $("#viewerNextButton").disabled =
    state.previewIndex < 0 || state.previewIndex >= state.visibleFiles.length - 1;
}

function openAdjacentPreview(delta) {
  const nextIndex = state.previewIndex + delta;
  if (nextIndex < 0 || nextIndex >= state.visibleFiles.length) return;
  const nextFile = state.visibleFiles[nextIndex];
  void openFilePreview(nextFile).catch(showError);
}

function isTextPreviewMime(mimeType) {
  return (
    mimeType?.startsWith("text/") ||
    [
      "application/json",
      "application/xml",
      "application/javascript",
      "application/typescript",
      "application/x-yaml",
      "application/yaml",
    ].includes(mimeType || "")
  );
}

async function openThumbnailPreview(file) {
  const body = $("#viewerBody");
  $("#viewerTitle").textContent = `${file.name} · ${t("thumb")}`;
  $("#viewerMeta").textContent = "image/jpeg";
  $("#viewerDownloadButton").onclick = () =>
    void downloadWithAuth(fileThumbnailUrl(file), `${file.name}.thumb.jpg`).catch(showError);
  body.innerHTML = "";
  body.className = "viewer-body image-mode";
  revealViewerBackdrop();
  const img = document.createElement("img");
  img.src = fileThumbnailUrl(file);
  img.alt = file.name;
  body.appendChild(createZoomableImagePreview(img));
}

function setInternalDrag(element, item) {
  element.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(INTERNAL_DRAG_TYPE, JSON.stringify(item));
  });
}

function readInternalDrag(event) {
  const raw = event.dataTransfer?.getData(INTERNAL_DRAG_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function makeDropTarget(element, targetFolderIdOrFn) {
  element.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types?.includes(INTERNAL_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    element.classList.add("drag-over");
  });
  element.addEventListener("dragleave", () => {
    element.classList.remove("drag-over");
  });
  element.addEventListener("drop", (event) => {
    const item = readInternalDrag(event);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    element.classList.remove("drag-over");
    const targetFolderId =
      typeof targetFolderIdOrFn === "function" ? targetFolderIdOrFn() : targetFolderIdOrFn;
    void moveDraggedItem(item, targetFolderId).catch(showError);
  });
}

async function moveDraggedItem(item, targetFolderId) {
  if (item.type === "file") {
    await api(`/files/${item.id}?duplicatePolicy=suffix`, {
      method: "PATCH",
      body: JSON.stringify({ folderId: targetFolderId }),
    });
  } else if (item.type === "folder") {
    if (item.id === targetFolderId) return;
    await withFolderProcessing([item.id], () =>
      api(`/folders/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ parentId: targetFolderId }),
      }),
    );
  } else {
    return;
  }
  toast(t("moved"));
  await loadDrive();
}

function folderMenuItems() {
  const isRoot = state.folderId === ROOT;
  return [
    { label: t("newFolder"), handler: () => createFolder() },
    { label: t("uploadFolder"), handler: () => $("#folderInput").click() },
    { label: t("downloadZip"), disabled: isRoot, handler: () => downloadFolderZip() },
    {
      label: t("copyFolder"),
      disabled: isRoot,
      handler: () => copyCurrentFolder(),
    },
    {
      label: t("deleteFolder"),
      variant: "danger",
      disabled: isRoot,
      handler: () => deleteCurrentFolder(),
    },
    { label: t("refresh"), handler: () => loadDrive() },
  ];
}

function uploadMenuItems() {
  if (isTouchLikePointer()) {
    return [
      { label: t("uploadMedia"), handler: () => $("#mediaInput").click() },
      { label: t("uploadFileManager"), handler: () => $("#fileInput").click() },
      { label: t("uploadFolder"), handler: () => uploadFolderFromPicker() },
    ];
  }
  return [
    { label: t("uploadFiles"), handler: () => $("#fileInput").click() },
    { label: t("uploadFolder"), handler: () => uploadFolderFromPicker() },
  ];
}

function actionButton(label, variant, handler) {
  const btn = document.createElement("button");
  btn.className = `small-action ${variant || ""}`;
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", async () => {
    try {
      btn.disabled = true;
      await handler();
    } catch (err) {
      toast(err.message || String(err));
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}

function linkButton(label, href) {
  const btn = document.createElement("button");
  btn.className = "small-action";
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", () => window.open(href, "_blank", "noopener"));
  return btn;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatQuotaGb(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "0";
  return (n / (1024 * 1024 * 1024)).toFixed(2);
}

function wireSelfTelegramForm() {
  const plat = $("#selfTelegramPlatform");
  const wrap = $("#selfTelegramCustomWrap");
  const save = $("#selfTelegramSave");
  if (!wrap || !save) return;
  if (plat) {
    const sync = () => {
      wrap.hidden = plat.checked;
    };
    plat.addEventListener("change", sync);
    sync();
  } else {
    wrap.hidden = false;
  }
  save.addEventListener("click", () => void saveSelfTelegram().catch(showError));
}

async function saveSelfTelegram() {
  const plat = $("#selfTelegramPlatform");
  const saveBtn = $("#selfTelegramSave");
  if (!saveBtn) return;
  const primary = state.accountProfile?.isPrimaryAdmin === true;
  const usePlatform = primary ? false : Boolean(plat?.checked);
  const body = { usePlatformTelegramStorage: usePlatform };
  if (!usePlatform) {
    const tok = $("#selfTelegramBotToken")?.value.trim();
    const chat = $("#selfTelegramChatId")?.value.trim();
    if (tok) body.telegramBotToken = tok;
    if (chat) body.telegramStorageChatId = chat;
  }
  saveBtn.disabled = true;
  try {
    await api("/auth/me/telegram", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    toast(t("telegramSaved"));
    const ta = $("#selfTelegramBotToken");
    if (ta) ta.value = "";
    await loadAppConfig();
  } finally {
    saveBtn.disabled = false;
  }
}

function renderSettingsSelf() {
  const root = $("#settingsSelfCard");
  if (!root) return;
  const profile = state.accountProfile;
  const headHint = $("#settingsHeadHint");
  if (!profile) {
    root.innerHTML = `<p class="settings-muted">${escapeHtml(t("loadingProfile"))}</p>`;
    if (headHint) headHint.textContent = "";
    return;
  }
  if (headHint) {
    headHint.textContent = accountIsAdmin() ? t("settingsHint") : t("settingsHintNonAdmin");
  }
  const hint =
    accountIsAdmin() && profile.minioLimitBytes <= 0
      ? `<p class="settings-muted">${escapeHtml(t("minioDisabledHint"))}</p>`
      : "";
  const usePlat = profile.telegramUsePlatformDefaults !== false;
  const primary = profile.isPrimaryAdmin === true;
  const chatVal = escapeHtml(profile.telegramStorageChatId ?? "");
  const platformBlock = primary
    ? `<p class="field-hint settings-telegram-hint">${escapeHtml(t("primaryAdminTelegramHint"))}</p>`
    : `<label class="modal-field modal-field-row settings-telegram-platform-row">
          <input type="checkbox" id="selfTelegramPlatform" ${usePlat ? "checked" : ""} />
          <span>${escapeHtml(t("usePlatformTelegramLabel"))}</span>
        </label>
        <p class="field-hint settings-telegram-hint">${escapeHtml(t("usePlatformTelegramHint"))}</p>`;
  root.innerHTML = `
    <article class="admin-card settings-account-card">
      <div class="admin-kv">
        <div class="admin-kv-row"><span>${escapeHtml(t("accountLabel"))}</span><span>${escapeHtml(profile.username)}</span></div>
        <div class="admin-kv-row"><span>${escapeHtml(t("roleLabel"))}</span><span>${escapeHtml(profile.role)}</span></div>
      </div>
      <div class="settings-self-telegram">
        <h3 class="settings-self-telegram-title">${escapeHtml(t("telegramConnectionTitle"))}</h3>
        ${platformBlock}
        <div id="selfTelegramCustomWrap" class="settings-telegram-custom">
          <label class="modal-field">
            <span>${escapeHtml(t("telegramBotTokenLabel"))}</span>
            <textarea id="selfTelegramBotToken" rows="3" spellcheck="false" autocomplete="off" placeholder="••••"></textarea>
          </label>
          <p class="field-hint">${escapeHtml(t("telegramBotTokenKeepHint"))}</p>
          <label class="modal-field">
            <span>${escapeHtml(t("telegramChatIdLabel"))}</span>
            <input id="selfTelegramChatId" type="text" spellcheck="false" autocomplete="off" value="${chatVal}" />
          </label>
        </div>
        <div class="settings-telegram-actions">
          <button type="button" class="primary-action compact" id="selfTelegramSave">${escapeHtml(t("telegramSaveConnection"))}</button>
        </div>
      </div>
      ${hint}
    </article>`;
  wireSelfTelegramForm();
}

async function loadSettingsView() {
  renderSettingsSelf();
}

function renderRuntimeSettingsConfigMarkup(data) {
  const eff = data.effective || {};
  const rows = RUNTIME_ADMIN_FORM_ROWS.map(([key, kind]) => {
    const id = `sys_${key}`;
    const rawVal = eff[key];
    if (kind === "checkbox") {
      const on = Boolean(rawVal);
      return `<label class="settings-runtime-row"><code>${escapeHtml(key)}</code><span><input type="checkbox" id="${id}" ${on ? "checked" : ""} /></span></label>`;
    }
    const str =
      rawVal === undefined || rawVal === null ? "" : typeof rawVal === "boolean" ? String(rawVal) : String(rawVal);
    if (kind === "textarea") {
      const escaped = escapeHtml(str);
      return `<label class="settings-runtime-row settings-runtime-row-stack"><code>${escapeHtml(key)}</code><textarea class="settings-runtime-input" id="${id}" rows="3" spellcheck="false">${escaped}</textarea></label>`;
    }
    const inputType = kind === "number" ? "number" : "text";
    const stepAttr = kind === "number" ? ' step="any" min="0"' : "";
    return `<label class="settings-runtime-row"><code>${escapeHtml(key)}</code><input class="settings-runtime-input" id="${id}" type="${inputType}"${stepAttr} value="${escapeHtml(str)}" /></label>`;
  }).join("");
  const overrides = (data.overriddenKeys || []).join(", ") || "—";
  return `
    <article class="admin-card settings-runtime-card">
      <div class="settings-runtime-fields">${rows}</div>
      <div class="settings-runtime-actions">
        <button type="button" class="primary-action compact" id="settingsSystemSaveButton">${escapeHtml(t("runtimeSave"))}</button>
      </div>
      <p class="settings-muted"><strong>${escapeHtml(t("runtimeOverridesHint"))}:</strong> ${escapeHtml(overrides)}</p>
    </article>`;
}

function renderRuntimeSettingsQueueMarkup(data) {
  const queueJson = escapeHtml(JSON.stringify(data.queueWorkerEnv || {}, null, 2));
  return `
    <article class="admin-card settings-queue-env-card">
      <pre class="settings-runtime-pre">${queueJson}</pre>
      <p class="settings-muted">${escapeHtml(data.queueWorkerHint || "")}</p>
    </article>`;
}

function mountRuntimeSettingsAdmin(data) {
  const configMount = $("#settingsSystemConfigMount");
  const queueMount = $("#settingsSystemQueueMount");
  if (!configMount || !queueMount) return;
  configMount.innerHTML = renderRuntimeSettingsConfigMarkup(data);
  queueMount.innerHTML = renderRuntimeSettingsQueueMarkup(data);
  $("#settingsSystemSaveButton")?.addEventListener("click", () =>
    void saveRuntimeSettings().catch(showError),
  );
}

function setAdminSettingsTab(tab) {
  if (!["config", "queue"].includes(tab)) {
    tab = "config";
  }
  state.adminSettingsTab = tab;
  $$(".settings-admin-tab").forEach((btn) => {
    const active = btn.dataset.adminSettingsTab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
  });
  const configPanel = $("#settingsSystemConfigPanel");
  const queuePanel = $("#settingsSystemQueuePanel");
  if (configPanel) {
    const showConfig = tab === "config";
    configPanel.classList.toggle("hidden", !showConfig);
    configPanel.hidden = !showConfig;
  }
  if (queuePanel) {
    const showQueue = tab === "queue";
    queuePanel.classList.toggle("hidden", !showQueue);
    queuePanel.hidden = !showQueue;
  }
}

function collectRuntimeSettingsPatch() {
  const patch = {};
  for (const [key, kind] of RUNTIME_ADMIN_FORM_ROWS) {
    const id = `sys_${key}`;
    const el = document.getElementById(id);
    if (!el) continue;
    if (kind === "checkbox") {
      patch[key] = el.checked;
      continue;
    }
    if (kind === "textarea") {
      const v = el.value.trim();
      patch[key] = v === "" ? null : v;
      continue;
    }
    const v = el.value.trim();
    if (v === "") {
      patch[key] = null;
      continue;
    }
    if (kind === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      patch[key] = n;
      continue;
    }
    patch[key] = v;
  }
  return patch;
}

async function loadRuntimeSettingsAdmin() {
  const configMount = $("#settingsSystemConfigMount");
  const queueMount = $("#settingsSystemQueueMount");
  if (!configMount || !queueMount || !accountIsAdmin()) return;
  const loading = `<p class="settings-muted">${escapeHtml(t("loadingProfile"))}</p>`;
  configMount.innerHTML = loading;
  queueMount.innerHTML = loading;
  setAdminSettingsTab(state.adminSettingsTab || "config");
  try {
    const data = await api("/admin/settings");
    state.adminRuntimeSettings = data;
    mountRuntimeSettingsAdmin(data);
  } catch (err) {
    configMount.innerHTML = "";
    queueMount.innerHTML = "";
    showError(err);
  }
}

async function saveRuntimeSettings() {
  const btn = $("#settingsSystemSaveButton");
  if (btn) btn.disabled = true;
  try {
    const patch = collectRuntimeSettingsPatch();
    const res = await api("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    state.adminRuntimeSettings = res;
    toast(t("runtimeSaved"));
    await Promise.all([loadAppConfig(), loadQuota()]);
    mountRuntimeSettingsAdmin(res);
  } catch (err) {
    showError(err);
  } finally {
    const savedBtn = $("#settingsSystemSaveButton");
    if (savedBtn) savedBtn.disabled = false;
  }
}

async function saveAccountAdminRow(accountId, roleEl, quotaEl, statusEl, buttonEl) {
  const minioLimitGb = Number(quotaEl.value);
  if (!Number.isFinite(minioLimitGb) || minioLimitGb < 0) {
    toast(t("inputRequired"));
    return;
  }
  const body = {
    role: roleEl.value,
    minioLimitGb,
    isActive: statusEl.value === "true",
  };
  buttonEl.disabled = true;
  try {
    await api(`/admin/accounts/${encodeURIComponent(accountId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    toast(t("accountSaved"));
    await loadAppConfig();
    await loadQuota();
    await loadAdminAccountsView();
  } catch (err) {
    showError(err);
  } finally {
    buttonEl.disabled = false;
  }
}

async function loadAdminAccountsView() {
  const wrap = $("#accountsTableWrap");
  if (!wrap || !accountIsAdmin()) return;
  wrap.innerHTML = `<p class="settings-muted">${escapeHtml(t("loadingProfile"))}</p>`;
  try {
    const rows = await api("/admin/accounts");
    wrap.innerHTML = "";
    const table = document.createElement("table");
    table.className = "settings-accounts-table";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr>
      <th>${escapeHtml(t("accountLabel"))}</th>
      <th>${escapeHtml(t("roleLabel"))}</th>
      <th>${escapeHtml(t("accountTelegramUsage"))}</th>
      <th>${escapeHtml(t("accountMinioUsage"))}</th>
      <th>${escapeHtml(t("accountMinioQuota"))}</th>
      <th>${escapeHtml(t("accountStatus"))}</th>
      <th></th>
    </tr>`;
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    const selfId = state.accountProfile?.id;
    for (const row of rows) {
      const tr = document.createElement("tr");
      const gbVal = Number(row.minioLimitGb ?? 0);
      const isSelf = selfId && row.id === selfId;
      const active = row.isActive !== false;
      tr.innerHTML = `
        <td>${escapeHtml(row.username)}</td>
        <td>
          <select class="settings-role-select" ${isSelf ? "disabled" : ""}>
            <option value="user" ${row.role === "user" ? "selected" : ""}>user</option>
            <option value="admin" ${row.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td class="settings-usage-cell">${escapeHtml(formatBytes(Number(row.telegramBytes || 0)))}</td>
        <td class="settings-usage-cell">${escapeHtml(formatAdminMinioUsage(row.minioBytes, row.minioLimitBytes))}</td>
        <td><input type="number" min="0" step="0.01" class="settings-quota-input" value="${gbVal}" /></td>
        <td>
          <select class="settings-status-select" ${isSelf ? "disabled" : ""}>
            <option value="true" ${active ? "selected" : ""}>${escapeHtml(t("accountActive"))}</option>
            <option value="false" ${!active ? "selected" : ""}>${escapeHtml(t("accountInactive"))}</option>
          </select>
        </td>
        <td><button type="button" class="ghost compact settings-account-save">${escapeHtml(t("saveQuota"))}</button></td>`;
      const btn = tr.querySelector(".settings-account-save");
      const roleEl = tr.querySelector(".settings-role-select");
      const quotaEl = tr.querySelector(".settings-quota-input");
      const statusEl = tr.querySelector(".settings-status-select");
      btn.addEventListener("click", () =>
        void saveAccountAdminRow(row.id, roleEl, quotaEl, statusEl, btn),
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
  } catch (err) {
    wrap.innerHTML = "";
    showError(err);
  }
}

async function loadQuota() {
  const quota = await api("/files/quota");
  $("#quotaTotal").textContent = `${formatBytes(quota.totalBytes)} / ${t("unlimited")}`;
  $("#quotaBar").style.width = quota.totalBytes > 0 ? "100%" : "8%";
  const minioBytes = Number(quota.minioBytes || 0);
  const accountLimit =
    quota.accountMinioLimitBytes !== undefined && quota.accountMinioLimitBytes !== null
      ? Number(quota.accountMinioLimitBytes)
      : Number(quota.minioLimitBytes || 0);
  const detailEl = $("#minioQuotaDetail");
  const barEl = $("#minioQuotaBar");
  if (accountLimit <= 0) {
    detailEl.textContent = `${formatBytes(minioBytes)} · ${t("minioDisabledHint")}`;
    barEl.style.width = minioBytes > 0 ? "100%" : "4%";
  } else {
    detailEl.textContent = `${formatBytes(minioBytes)} / ${formatBytes(accountLimit)}`;
    barEl.style.width = `${Math.min(100, Math.max(4, (minioBytes / accountLimit) * 100))}%`;
  }
}

async function loadDrive() {
  renderBreadcrumbs();
  syncFolderActions();
  const data = await api(`/folders/${encodeURIComponent(state.folderId)}/contents?fileLimit=200&folderLimit=200`);
  renderFolders(data.folders || []);
  renderFileList("#fileList", data.files || []);
  persistNavigationState();
}

async function loadImages() {
  const result = await api(
    "/files/search?mimePrefix=image%2F&limit=200&sortBy=createdAt&sortOrder=desc",
  );
  renderFileList("#imagesList", result.items || [], "images");
  persistNavigationState();
}

function syncFolderActions() {
  $("#folderMenuButton").title = t("rightClickHint");
}

async function loadTrash(folderId = state.trashFolderId) {
  const isRoot = folderId === ROOT;
  const data = await api(
    isRoot ? "/files/trash?limit=200" : `/files/trash/folders/${encodeURIComponent(folderId)}/contents`,
  );
  state.trashFolderId = folderId;
  if (isRoot) {
    state.trashPath = [];
  }
  renderTrashBreadcrumbs();
  renderTrashFolders(data.folders || []);
  const files = trashFilesFromResponse(data);
  renderFileList("#trashList", files, "trash");
  if ((data.folders || []).length && !files.length) {
    $("#trashList").innerHTML = "";
  }
}

function trashFilesFromResponse(data) {
  return data.items || data.files || [];
}

function renderTrashBreadcrumbs() {
  const view = $("#trashView");
  let row = $("#trashBreadcrumbRow");
  if (!row) {
    row = document.createElement("div");
    row.id = "trashBreadcrumbRow";
    row.className = "path-row";
    row.innerHTML = `
      <button class="ghost path-back" id="trashBackButton" title="Back">←</button>
      <div class="breadcrumbs" id="trashBreadcrumbs"></div>
    `;
    view.querySelector(".panel-head").after(row);
    $("#trashBackButton").addEventListener("click", () => {
      if (state.trashPath.length <= 1) {
        state.trashPath = [];
        void loadTrash(ROOT).catch(showError);
        return;
      }
      state.trashPath.pop();
      const parent = state.trashPath[state.trashPath.length - 1];
      void loadTrash(parent.id).catch(showError);
    });
  }
  $("#trashBackButton").disabled = state.trashFolderId === ROOT;
  const crumbs = $("#trashBreadcrumbs");
  crumbs.innerHTML = "";
  const rootBtn = document.createElement("button");
  rootBtn.type = "button";
  rootBtn.textContent = t("trash");
  rootBtn.addEventListener("click", () => {
    state.trashPath = [];
    void loadTrash(ROOT).catch(showError);
  });
  crumbs.appendChild(rootBtn);
  state.trashPath.forEach((folder, index) => {
    const sep = document.createElement("span");
    sep.textContent = "/";
    crumbs.appendChild(sep);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = folder.name;
    btn.addEventListener("click", () => {
      state.trashPath = state.trashPath.slice(0, index + 1);
      void loadTrash(folder.id).catch(showError);
    });
    crumbs.appendChild(btn);
  });
}

function openTrashFolder(folder) {
  const existingIndex = state.trashPath.findIndex((item) => item.id === folder.id);
  if (existingIndex >= 0) {
    state.trashPath = state.trashPath.slice(0, existingIndex + 1);
  } else {
    state.trashPath.push({ id: folder.id, name: folder.name });
  }
  void loadTrash(folder.id).catch(showError);
}

function renderTrashFolders(folders) {
  const grid = $("#trashFolderGrid");
  grid.innerHTML = "";
  if (!folders.length) return;
  folders.forEach((folder) => {
    const btn = document.createElement("button");
    btn.className = "folder-card";
    btn.dataset.folderId = folder.id;
    btn.classList.toggle("processing", state.processingFolderIds.has(folder.id));
    btn.toggleAttribute("aria-busy", state.processingFolderIds.has(folder.id));
    btn.dataset.processingLabel = t("processing");
    btn.disabled = state.processingFolderIds.has(folder.id);
    btn.innerHTML = `<img class="folder-icon" src="/folder.png" alt="" /><strong></strong>`;
    btn.querySelector("strong").textContent = folder.name;
    btn.addEventListener("click", () => openTrashFolder(folder));
    attachContextMenu(btn, btn, () => {
      const items = [{ label: t("open"), handler: () => openTrashFolder(folder) }];
      if (folder.deletedAt) {
        items.push(
          {
            label: t("restore"),
            variant: "success",
            handler: async () => {
              await api(`/files/trash/folders/${folder.id}/restore`, { method: "POST" });
              toast(t("restored"));
              await Promise.all([loadTrash(), loadQuota(), loadDrive()]);
            },
          },
          {
            label: t("permanentDelete"),
            variant: "danger",
            handler: async () => {
              await api(`/files/trash/folders/${folder.id}`, { method: "DELETE" });
              toast(t("deleted"));
              await Promise.all([loadTrash(), loadQuota()]);
            },
          },
        );
      }
      return items;
    });
    grid.appendChild(btn);
  });
}

async function emptyTrash() {
  const ok = await openConfirmModal({
    title: t("emptyTrash"),
    description: t("confirmEmptyTrash"),
  });
  if (!ok) return;
  await api("/files/trash", { method: "DELETE" });
  toast(t("deleted"));
  await Promise.all([loadTrash(), loadQuota(), loadDrive()]);
}

async function loadQueue() {
  const data = await api("/admin/queue/jobs?state=failed&start=0&end=49");
  const list = $("#queueList");
  list.innerHTML = "";
  if (!data.jobs?.length) {
    list.appendChild(emptyNode());
    return;
  }
  data.jobs.forEach((job) => {
    const row = document.createElement("article");
    row.className = "file-row";
    row.innerHTML = `
      <div class="file-main">
        <span class="file-icon">↻</span>
        <div>
          <div class="file-name">${escapeHtml(job.fileName || job.id || "")}</div>
          <div class="muted">${escapeHtml(job.failedReason || "")}</div>
        </div>
      </div>
      <div class="muted">${escapeHtml(job.mimeType || "")}</div>
      <div class="muted">${job.attemptsMade || 0}/${job.attempts || 1}</div>
      <div class="row-actions"></div>
    `;
    const actions = row.querySelector(".row-actions");
    const retry = actionButton(t("retry"), "success", async () => {
      await api(`/admin/queue/jobs/${encodeURIComponent(job.id)}/retry`, { method: "POST" });
      toast(t("retryDone"));
      await loadQueue();
    });
    retry.disabled = !job.canRetry;
    actions.appendChild(retry);
    actions.appendChild(
      actionButton(t("deleteRetryFile"), "danger", async () => {
        await api(`/admin/queue/jobs/${encodeURIComponent(job.id)}`, { method: "DELETE" });
        toast(t("deleted"));
        await loadQueue();
      }),
    );
    list.appendChild(row);
  });
}

async function createFolder() {
  const name = await openTextModal({
    title: t("newFolder"),
    label: t("folderNamePrompt"),
  });
  if (!name?.trim()) return;
  await api("/folders", {
    method: "POST",
    body: JSON.stringify({
      name: name.trim(),
      parentId: state.folderId === ROOT ? undefined : state.folderId,
    }),
  });
  toast(t("folderCreated"));
  await loadDrive();
}

async function createCloudFolder(name, parentId = state.folderId) {
  return api("/folders", {
    method: "POST",
    body: JSON.stringify({
      name,
      parentId: parentId === ROOT ? undefined : parentId,
    }),
  });
}

async function createCloudFolderUnique(name, parentId = state.folderId) {
  for (let n = 0; n < 100; n++) {
    const candidate = n === 0 ? name : `${name} (${n})`;
    try {
      return await createCloudFolder(candidate, parentId);
    } catch (err) {
      if (!String(err.message || err).startsWith("409")) {
        throw err;
      }
    }
  }
  throw new Error("Cannot allocate folder name");
}

async function findChildFolderByName(parentId, name) {
  const data = await api(`/folders/${encodeURIComponent(parentId || ROOT)}/contents?folderLimit=500&fileLimit=1`);
  return (data.folders || []).find((folder) => folder.name === name) || null;
}

async function resolveRootUploadFolder(rootName) {
  const existing = await findChildFolderByName(state.folderId, rootName);
  if (!existing) {
    return createCloudFolder(rootName, state.folderId);
  }
  const choice = await openChoiceModal({
    title: t("folderExistsTitle"),
    description: t("folderExistsHint"),
    primaryLabel: t("mergeFolder"),
    secondaryLabel: t("renameFolderCopy"),
  });
  if (choice === "primary") {
    return existing;
  }
  if (choice === "secondary") {
    return createCloudFolderUnique(rootName, state.folderId);
  }
  throw new Error("Cancelled");
}

async function resolveChildUploadFolder(name, parentId) {
  const existing = await findChildFolderByName(parentId, name);
  return existing || createCloudFolder(name, parentId);
}

async function uploadFile(file) {
  if (!file) return;
  await enqueueUpload(file, state.folderId);
}

async function uploadFileRecord(record) {
  if (record.jobId) {
    return { jobId: record.jobId, transferId: record.id };
  }
  const form = new FormData();
  form.append("file", record.file, record.fileName);
  if (record.folderId && record.folderId !== ROOT) form.append("folderId", record.folderId);
  const params = new URLSearchParams({ duplicatePolicy: "suffix" });
  if (record.allowDuplicateContent) {
    params.set("allowDuplicateContent", "1");
  }
  const queued = await uploadWithProgress(
    `/files/upload/async?${params.toString()}`,
    form,
    record.file,
    record.id,
  );
  record.jobId = queued.jobId;
  record.status = "processing";
  delete record.retryAfter;
  await putUploadRecord(record);
  toast(`${t("uploaded")} #${queued.jobId}`);
  return queued;
}

async function uploadWithProgress(path, form, file, transferId = createTransfer("upload", file.name), retriedAuth = false) {
  await ensureAuth();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;
    let lastTime = performance.now();
    xhr.open("POST", `${API}${path}`);
    xhr.setRequestHeader("Authorization", `Basic ${state.authToken}`);
    xhr.setRequestHeader("X-Auth-Mode", "app");
    state.transferAborters.set(transferId, () => xhr.abort());
    xhr.upload.onprogress = (event) => {
      if (!state.transfers.get(transferId)) return;
      const speed = measureTransferSpeed(transferId, event.loaded, lastLoaded, lastTime);
      lastLoaded = event.loaded;
      lastTime = performance.now();
      updateTransfer(transferId, {
        loaded: event.loaded,
        total: event.total || file.size,
        speed,
        status: t("uploading"),
      });
    };
    xhr.onload = () => {
      state.transferAborters.delete(transferId);
      if (xhr.status >= 200 && xhr.status < 300) {
        updateTransfer(transferId, { status: t("processing"), speed: 0, loaded: file.size, total: file.size, cancelable: false });
        resolve({ ...JSON.parse(xhr.responseText), transferId });
        return;
      }
      if (xhr.status === 401) {
        updateTransfer(transferId, { status: t("loginInvalid"), error: true, speed: 0, cancelable: true });
        void forceReauth()
          .then(() => {
            if (retriedAuth) {
              throw new Error(`${xhr.status}: ${xhr.responseText || xhr.statusText}`);
            }
            return uploadWithProgress(path, form, file, transferId, true);
          })
          .then(resolve, reject);
        return;
      }
      updateTransfer(transferId, { status: `HTTP ${xhr.status}`, error: true, speed: 0, cancelable: true });
      reject(new Error(`${xhr.status}: ${xhr.responseText || xhr.statusText}`));
    };
    xhr.onerror = () => {
      state.transferAborters.delete(transferId);
      updateTransfer(transferId, { status: "Network error", error: true, speed: 0, cancelable: true });
      reject(new Error("Network error"));
    };
    xhr.onabort = () => {
      state.transferAborters.delete(transferId);
      reject(transferCanceledError());
    };
    xhr.send(form);
  });
}

async function uploadFiles(files) {
  const list = filterUploadableFiles(files).filter((file) => file && file.size >= 0);
  let queued = 0;
  for (const file of list) {
    if (await enqueueUpload(file, state.folderId)) queued++;
  }
  if (queued > 0) {
    void processUploadQueue().catch(showError);
  }
}

/** Một số FS/mount trả `\\` trong webkitRelativePath — chuẩn hóa và bỏ segment folder gốc đã chọn. */
function normalizedFolderEntryRelativePath(webkitRelativePath, fileName) {
  const parts = String(webkitRelativePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  if (parts.length <= 1) return fileName || parts[0] || "";
  return parts.slice(1).join("/") || fileName || "";
}

/**
 * Chromium/Linux đôi khi chèn pseudo-file cho thư mục: `webkitRelativePath` chỉ một segment (tên folder gốc),
 * không phải `Root/file…`. Không đưa vào queue upload — folder đã được tạo qua API bằng các entry thật.
 */
function isWebkitRelativeDirectoryArtifact(file) {
  const wrp = String(file.webkitRelativePath || "").replace(/\\/g, "/").trim();
  if (!wrp) return false;
  const segments = wrp.split("/").filter(Boolean);
  return segments.length < 2;
}

function inferRootNameFromFile(file) {
  const wrp = String(file?.webkitRelativePath || "").replace(/\\/g, "/").trim();
  if (!wrp) return null;
  return wrp.split("/").filter(Boolean)[0] || null;
}

function inferFolderDropRootName(files) {
  const roots = new Set();
  for (const file of files || []) {
    const root = inferRootNameFromFile(file);
    if (root) roots.add(root);
  }
  if (roots.size === 1) return [...roots][0];
  return null;
}

function isLikelyDirectoryPlaceholderFile(file, rootName) {
  if (!file) return false;
  if (isWebkitRelativeDirectoryArtifact(file)) return true;
  const root = String(rootName || inferRootNameFromFile(file) || "").trim();
  const name = String(file.name || "").trim();
  if (!root || name !== root) return false;
  const wrp = String(file.webkitRelativePath || "").replace(/\\/g, "/").trim();
  if (wrp) {
    const segments = wrp.split("/").filter(Boolean);
    return segments.length < 2;
  }
  return Number(file.size || 0) <= 4096;
}

function isFolderUploadEntryArtifact(entry, rootName) {
  return isLikelyDirectoryPlaceholderFile(entry.file, rootName);
}

function filterUploadableFiles(files, rootName) {
  const inferredRoot = rootName || inferFolderDropRootName(files);
  return uniqueDroppedFiles(Array.from(files || [])).filter(
    (file) => !isLikelyDirectoryPlaceholderFile(file, inferredRoot),
  );
}

async function purgeFolderPlaceholderTransfers(rootName) {
  const root = String(rootName || "").trim();
  if (!root) return;
  for (const [id, item] of [...state.transfers.entries()]) {
    if (item.kind !== "upload" || item.name !== root) continue;
    if (Number(item.total || 0) > 16384) continue;
    state.transfers.delete(id);
  }
  const records = await getAllUploadRecords();
  for (const record of records) {
    const file = record.file;
    if (file && !isLikelyDirectoryPlaceholderFile(file, root)) continue;
    if (!file && record.fileName !== root) continue;
    await deleteUploadRecord(record.id);
    state.transfers.delete(record.id);
  }
  renderTransfers();
}

async function uploadFileToFolder(file, folderId) {
  if (!file) return;
  await enqueueUpload(file, folderId);
}

async function uploadFolderFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.webkitRelativePath);
  if (!files.length) return;
  const firstNorm = String(files[0].webkitRelativePath).replace(/\\/g, "/");
  const rootName = firstNorm.split("/").filter(Boolean)[0] || "folder";
  const entries = files.map((file) => ({
    file,
    relativePath: normalizedFolderEntryRelativePath(file.webkitRelativePath, file.name),
  }));
  await uploadFolderEntries(rootName, entries);
}

async function uploadFolderFromPicker() {
  if (typeof window.showDirectoryPicker !== "function") {
    toast(t("folderPickerUnsupported"));
    return;
  }
  const handle = await window.showDirectoryPicker();
  const entries = await readDirectoryHandle(handle);
  await uploadFolderEntries(handle.name || "folder", entries);
}

async function uploadFolderEntries(rootName, entries) {
  if (!entries.length) return;

  await purgeFolderPlaceholderTransfers(rootName);

  const filteredEntries = entries.filter((entry) => !isFolderUploadEntryArtifact(entry, rootName));

  const validEntries = [];
  let skipped = 0;
  for (const entry of filteredEntries) {
    if (canUploadFile(entry.file)) {
      validEntries.push(entry);
    } else {
      skipped++;
    }
  }

  const rootFolder = await resolveRootUploadFolder(rootName);
  const folderMap = new Map([["", rootFolder.id]]);

  if (!validEntries.length) {
    await Promise.all([loadDrive(), loadQuota()]);
    toast(t("folderCreated"));
    return;
  }

  const queuedUploads = [];

  for (const entry of validEntries) {
    const parts = String(entry.relativePath || "").replace(/\\/g, "/").split("/").filter(Boolean);
    const fileName = parts.pop() || entry.file.name;
    let parentId = rootFolder.id;
    let key = "";
    for (const part of parts) {
      key = key ? `${key}/${part}` : part;
      if (!folderMap.has(key)) {
        const created = await resolveChildUploadFolder(part, parentId);
        folderMap.set(key, created.id);
      }
      parentId = folderMap.get(key);
    }
    const fileForUpload = new File([entry.file], fileName, {
      type: entry.file.type,
      lastModified: entry.file.lastModified,
    });
    queuedUploads.push({ file: fileForUpload, folderId: parentId });
  }

  for (const item of queuedUploads) {
    await enqueueUpload(item.file, item.folderId);
  }
  if (queuedUploads.length > 0) {
    void processUploadQueue().catch(showError);
    toast(`${queuedUploads.length} ${t("queued")}${skipped ? ` · ${skipped} ${t("uploadTooLarge")}` : ""}`);
  }
  await purgeFolderPlaceholderTransfers(rootName);
  await Promise.all([loadDrive(), loadQuota()]);
}

async function uploadDroppedItems(dataTransfer) {
  const directFiles = Array.from(dataTransfer.files || []);
  const items = Array.from(dataTransfer.items || []);
  const hasDirectoryEntry = items.some((item) => {
    try {
      const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
      return Boolean(entry?.isDirectory);
    } catch {
      return false;
    }
  });

  if (directFiles.length && !hasDirectoryEntry) {
    const inferredRoot = inferFolderDropRootName(directFiles);
    const withRelativePath = directFiles.filter((file) => file.webkitRelativePath);
    const withoutRelativePath = filterUploadableFiles(
      directFiles.filter((file) => !file.webkitRelativePath),
      inferredRoot,
    );
    if (inferredRoot && withRelativePath.length) {
      const entries = withRelativePath.map((file) => ({
        file,
        relativePath: normalizedFolderEntryRelativePath(file.webkitRelativePath, file.name),
      }));
      await uploadFolderEntries(inferredRoot, entries);
    }
    if (withoutRelativePath.length) {
      toast(`${withoutRelativePath.length} ${t("queued")}`);
      await uploadFiles(withoutRelativePath);
    }
    return;
  }

  let handledDirectoryDrop = false;
  const looseFiles = [];
  for (const item of items) {
    try {
      const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
      if (entry?.isDirectory) {
        handledDirectoryDrop = true;
        const files = await readDirectoryEntry(entry);
        await uploadFolderEntries(entry.name, files);
      } else if (entry?.isFile) {
        looseFiles.push(await readFileEntry(entry));
      } else {
        const file = item.getAsFile?.();
        if (file) looseFiles.push(file);
      }
    } catch {
      const file = item.getAsFile?.();
      if (file) looseFiles.push(file);
    }
  }

  if (!handledDirectoryDrop) {
    looseFiles.push(...directFiles);
  }

  if (looseFiles.length) {
    const inferredRoot = inferFolderDropRootName(looseFiles);
    const files = filterUploadableFiles(looseFiles, inferredRoot);
    if (!files.length) return;
    toast(`${files.length} ${t("queued")}`);
    await uploadFiles(files);
  }
}

function uniqueDroppedFiles(files) {
  const seen = new Set();
  return files.filter((file) => {
    const key = `${file.name}:${file.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readDirectoryEntry(directoryEntry, prefix = "") {
  const reader = directoryEntry.createReader();
  const out = [];
  while (true) {
    const entries = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!entries.length) break;
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        out.push(...(await readDirectoryEntry(entry, relativePath)));
      } else if (entry.isFile) {
        out.push({
          file: await readFileEntry(entry),
          relativePath,
        });
      }
    }
  }
  return out;
}

async function readDirectoryHandle(directoryHandle, prefix = "") {
  const out = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    const relativePath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      out.push(...(await readDirectoryHandle(handle, relativePath)));
    } else if (handle.kind === "file") {
      out.push({
        file: await handle.getFile(),
        relativePath,
      });
    }
  }
  return out;
}

function readFileEntry(fileEntry) {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

function uploadJobPollBudget(fileSizeBytes) {
  const mb = Number(fileSizeBytes) / (1024 * 1024);
  if (mb > 120) return 260;
  if (mb > 40) return 180;
  if (mb > 12) return 140;
  return 100;
}

async function watchUploadJob(jobId, transferId, fileSizeBytes = 0) {
  const maxPolls = uploadJobPollBudget(fileSizeBytes);
  let consecutiveApiErrors = 0;
  for (let poll = 0; poll < maxPolls; poll++) {
    const delayMs =
      poll < 8 ? UPLOAD_JOB_POLL_QUICK_MS : poll < 40 ? UPLOAD_JOB_POLL_MEDIUM_MS : UPLOAD_JOB_POLL_SLOW_MS;
    await delay(delayMs);
    let status;
    try {
      status = await api(`/files/upload/jobs/${encodeURIComponent(jobId)}`);
      consecutiveApiErrors = 0;
    } catch {
      consecutiveApiErrors++;
      if (consecutiveApiErrors >= 18) {
        updateTransfer(transferId, {
          status: t("uploadFailed"),
          error: true,
          speed: 0,
          cancelable: false,
        });
        toast(`${t("uploadFailed")}: poll job`);
        await loadQueue().catch(() => undefined);
        return "pollFailed";
      }
      poll--;
      continue;
    }
    if (status.state === "completed") {
      if (status.result?.skippedDuplicate) {
        const reason = status.result.skippedDuplicateReason || t("uploadFailed");
        updateTransfer(transferId, { status: reason, error: false, speed: 0, cancelable: false });
        const choice = await openChoiceModal({
          title: t("duplicateImageTitle"),
          description: `${t("duplicateImageHint")}\n\n${reason}`,
          primaryLabel: t("addDuplicateAnyway"),
          secondaryLabel: t("skipDuplicateUpload"),
        });
        await Promise.all([loadDrive(), loadQuota()]);
        if (choice === "primary") {
          return "addDuplicateAnyway";
        }
        state.transfers.delete(transferId);
        renderTransfers();
        toast(t("duplicateSkipped"));
        return "skipDuplicate";
      }
      finishTransfer(transferId, t("done"));
      toast(t("uploadCompleted"));
      await Promise.all([loadDrive(), loadQuota()]);
      return "completed";
    }
    if (status.state === "failed") {
      updateTransfer(transferId, { status: status.failedReason || t("uploadFailed"), error: true, speed: 0 });
      toast(`${t("uploadFailed")}: ${status.failedReason || jobId}`);
      await loadQueue().catch(() => undefined);
      return "failed";
    }
  }
  updateTransfer(transferId, {
    status: t("uploadJobTimedOut"),
    error: true,
    speed: 0,
    cancelable: false,
  });
  toast(t("uploadJobTimedOutToast"));
  await loadQueue().catch(() => undefined);
  return "timeout";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createShare(fileId) {
  const data = await api(`/files/${fileId}/share-download`, {
    method: "POST",
    body: JSON.stringify({ ttlSeconds: 86400 }),
  });
  const link = data.downloadUrl || `${location.origin}${data.downloadPath}`;
  await navigator.clipboard.writeText(link);
  toast(t("copied"));
}

async function editTags(file) {
  const current = (file.tags || []).join(", ");
  const raw = await openTextModal({
    title: t("tags"),
    label: t("tagsPrompt"),
    value: current,
    required: false,
  });
  if (raw === null) return;
  const tags = raw.split(",").map((tag) => tag.trim()).filter(Boolean);
  await api(`/files/${file.id}/tags`, {
    method: "PATCH",
    body: JSON.stringify({ tags }),
  });
  toast(t("saved"));
  if (state.searchActive) {
    $("#searchForm").requestSubmit();
  } else {
    await refreshAfterFilePatch();
  }
}

async function renameFile(file) {
  const name = await openTextModal({
    title: t("rename"),
    label: t("renamePrompt"),
    value: file.name,
  });
  if (!name?.trim() || name.trim() === file.name) return;
  const saved = await api(`/files/${file.id}?duplicatePolicy=suffix`, {
    method: "PATCH",
    body: JSON.stringify({ name: name.trim() }),
  });
  toast(t("saved"));
  await refreshAfterFilePatch(saved.id);
}

async function moveFile(file) {
  const folderId = await openFolderPicker({
    title: t("move"),
  });
  if (!folderId) return;
  const saved = await api(`/files/${file.id}?duplicatePolicy=suffix`, {
    method: "PATCH",
    body: JSON.stringify({ folderId }),
  });
  toast(t("saved"));
  await refreshAfterFilePatch(saved.id);
}

async function moveFolder(folder) {
  const parentId = await openFolderPicker({
    title: t("move"),
  });
  if (!parentId) return;
  await withFolderProcessing([folder.id], () =>
    api(`/folders/${folder.id}`, {
      method: "PATCH",
      body: JSON.stringify({ parentId }),
    }),
  );
  toast(t("moved"));
  await refreshAfterFilePatch();
}

async function deleteSelectedFiles() {
  const folders = selectedVisibleFolders();
  const files = selectedVisibleFiles();
  const count = folders.length + files.length;
  if (!count) return;
  const ok = await openConfirmModal({
    title: t("deleteSelected"),
    description: `${t("confirmDeleteSelected")} (${count})`,
  });
  if (!ok) return;
  await withFolderProcessing(
    folders.map((folder) => folder.id),
    () =>
      Promise.all([
        ...files.map((file) => api(`/files/${file.id}`, { method: "DELETE" })),
        ...folders.map((folder) => api(`/folders/${folder.id}`, { method: "DELETE" })),
      ]),
  );
  clearFileSelection();
  toast(t("deleted"));
  await Promise.all([refreshAfterFilePatch(), loadQuota()]);
}

async function moveSelectedFiles() {
  const folders = selectedVisibleFolders();
  const files = selectedVisibleFiles();
  const count = folders.length + files.length;
  if (!count) return;
  const folderId = await openFolderPicker({
    title: t("moveSelected"),
  });
  if (!folderId) return;
  const targetFolderId = folderId;
  await withFolderProcessing(
    folders.map((folder) => folder.id),
    () =>
      Promise.all([
        ...files.map((file) =>
          api(`/files/${file.id}?duplicatePolicy=suffix`, {
            method: "PATCH",
            body: JSON.stringify({ folderId: targetFolderId }),
          }),
        ),
        ...folders.map((folder) =>
          api(`/folders/${folder.id}`, {
            method: "PATCH",
            body: JSON.stringify({ parentId: targetFolderId }),
          }),
        ),
      ]),
  );
  clearFileSelection();
  toast(t("moved"));
  await refreshAfterFilePatch();
}

async function refreshAfterFilePatch() {
  if (state.searchActive) {
    $("#searchForm").requestSubmit();
    return;
  }
  if (state.view === "images") {
    await loadImages();
    return;
  }
  await loadDrive();
}

async function showItemInfo(type, item) {
  let payload;
  if (type === "folder") {
    const contents = await api(
      `/folders/${encodeURIComponent(item.id)}/contents?folderLimit=500&fileLimit=500`,
    );
    payload = {
      id: item.id,
      name: item.name,
      parentId: item.parentId ?? null,
      deletedAt: item.deletedAt ?? null,
      childFolders: (contents.folders || []).length,
      files: (contents.files || []).length,
    };
  } else {
    const [meta, tags] = await Promise.all([
      api(`/files/${item.id}`),
      api(`/files/${item.id}/tags`),
    ]);
    payload = { ...meta, tags };
  }
  await openReadOnlyInfoModal(t("info"), JSON.stringify(payload, null, 2));
}

async function downloadFolderZip(folderId = state.folderId) {
  const decision = await api(`/folders/${encodeURIComponent(folderId)}/download/auto`, {
    method: "POST",
  });
  if (decision.mode === "direct" && decision.downloadPath) {
    await downloadWithAuth(decision.downloadPath, `${decision.zipBaseName || "folder"}.zip`);
    return;
  }
  if (!decision.jobId) {
    throw new Error("Missing ZIP jobId");
  }
  toast(`${t("downloadZip")} #${decision.jobId}`);
  for (let attempt = 0; attempt < 40; attempt++) {
    await delay(attempt < 4 ? 1000 : 2500);
    const status = await api(`/folders/download/jobs/${encodeURIComponent(decision.jobId)}`);
    if (status.state === "completed" && status.downloadStreamPath) {
      toast(t("zipReady"));
      window.open(status.downloadStreamPath, "_blank", "noopener");
      return;
    }
    if (status.state === "failed") {
      throw new Error(status.failedReason || "ZIP failed");
    }
  }
}

async function copyFolder(folderId) {
  const parentId = await openTextModal({
    title: t("copyFolder"),
    label: t("movePrompt"),
    value: ROOT,
  });
  if (!parentId?.trim()) return;
  const copied = await api(`/folders/${folderId}/copy`, {
    method: "POST",
    body: JSON.stringify({ parentId: parentId.trim() }),
  });
  toast(t("folderCopied"));
  showAdminOutput(copied);
}

async function copyCurrentFolder() {
  if (state.folderId === ROOT) return;
  await copyFolder(state.folderId);
}

async function deleteFolder(folderId, folderName) {
  if (
    folderId === ROOT ||
    !(await openConfirmModal({
      title: t("deleteFolder"),
      description: folderName ? `${t("confirmDeleteFolder")} (${folderName})` : t("confirmDeleteFolder"),
    }))
  ) {
    return;
  }
  await withFolderProcessing([folderId], async () => {
    await api(`/folders/${folderId}`, { method: "DELETE" });
    const pathIndex = state.path.findIndex((crumb) => crumb.id === folderId);
    if (pathIndex >= 0) {
      state.path = state.path.slice(0, Math.max(1, pathIndex));
      state.folderId = state.path[state.path.length - 1]?.id || ROOT;
    }
    toast(t("folderDeleted"));
    await Promise.all([loadDrive(), loadQuota()]);
  });
}

async function deleteCurrentFolder() {
  await deleteFolder(state.folderId);
}

function showAdminOutput(value) {
  const out = $("#adminOutput");
  out.innerHTML = "";
  out.appendChild(renderAdminValue(value));
}

function renderAdminValue(value, key = "") {
  if (Array.isArray(value)) {
    const wrap = document.createElement("div");
    wrap.className = "admin-result-list";
    if (!value.length) {
      wrap.appendChild(emptyNode());
      return wrap;
    }
    value.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "admin-result-card";
      const title = document.createElement("strong");
      title.textContent = item?.fileName || item?.id || item?.telegramFileUniqueId || `${key || "Item"} #${index + 1}`;
      card.appendChild(title);
      card.appendChild(renderAdminValue(item));
      wrap.appendChild(card);
    });
    return wrap;
  }
  if (value && typeof value === "object") {
    const wrap = document.createElement("div");
    wrap.className = "admin-kv";
    Object.entries(value).forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "admin-kv-row";
      const label = document.createElement("span");
      label.textContent = k;
      const content = document.createElement("div");
      if (v && typeof v === "object") {
        content.appendChild(renderAdminValue(v, k));
      } else {
        content.textContent = String(v ?? "-");
      }
      row.append(label, content);
      wrap.appendChild(row);
    });
    return wrap;
  }
  const span = document.createElement("span");
  span.textContent = String(value ?? "-");
  return span;
}

function isAdvancedSearchOpen() {
  return !$("#advancedSearchFields").classList.contains("hidden");
}

function setDriveSearchActive(active, opts = {}) {
  state.searchActive = active;
  if (active) {
    state.selectedFolderIds.clear();
    syncSelectedRows();
    syncSelectionBar();
  }
  if (!active) {
    state.visibleFiles = state.driveFiles;
  }
  $("#searchSummary").classList.toggle("hidden", !active);
  $("#searchResults").classList.toggle("hidden", !active);
  $("#folderGrid").classList.toggle("hidden", active);
  $("#fileList").classList.toggle("hidden", active);
  if (opts.persist !== false) {
    persistNavigationState();
  }
}

function clearDriveSearch(opts = {}) {
  const form = $("#searchForm");
  if (form) form.reset();
  $("#searchResults").innerHTML = "";
  setDriveSearchActive(false, opts);
}

async function runSearch(form) {
  const params = new URLSearchParams();
  const data = new FormData(form);
  const advancedOpen = isAdvancedSearchOpen();
  for (const [key, value] of data.entries()) {
    if (key !== "q" && !advancedOpen) continue;
    if (String(value).trim()) params.set(key, String(value).trim());
  }
  if (![...params.keys()].length) {
    clearDriveSearch();
    return;
  }
  params.set("limit", "100");
  const result = await api(`/files/search?${params.toString()}`);
  setDriveSearchActive(true);
  renderFileList("#searchResults", result.items || [], "search");
  persistNavigationState();
}

function wireEvents() {
  window.addEventListener("pagehide", persistActiveTransferSnapshots);
  wireReloadTransferGuard();
  window.addEventListener("click", hideContextMenu);
  window.addEventListener("scroll", hideContextMenu, true);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideContextMenu();
      const previewWasOpen = !$("#viewerBackdrop").classList.contains("hidden");
      closeFilePreview();
      if (!previewWasOpen && touchBulkSelectActive()) {
        exitSelectionMode();
      }
    }
    if (!$("#viewerBackdrop").classList.contains("hidden")) {
      if (event.key === "ArrowLeft") openAdjacentPreview(-1);
      if (event.key === "ArrowRight") openAdjacentPreview(1);
    }
  });
  $("#driveView").addEventListener("contextmenu", (event) => {
    if (event.target.closest(".file-row") || event.target.closest(".folder-card")) return;
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, folderMenuItems());
  });
  makeDropTarget($("#driveView"), () => state.folderId);
  $("#folderMenuButton").addEventListener("click", (event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    showContextMenu(rect.left, rect.bottom + 6, folderMenuItems());
  });
  $("#viewerCloseButton").addEventListener("click", closeFilePreview);
  $("#viewerPrevButton").addEventListener("click", () => openAdjacentPreview(-1));
  $("#viewerNextButton").addEventListener("click", () => openAdjacentPreview(1));
  $("#viewerBackdrop").addEventListener("click", (event) => {
    if (event.target !== event.currentTarget) return;
    if (performance.now() < state.previewBackdropGuardUntil) return;
    closeFilePreview();
  });
  $("#logoutButton").addEventListener("click", () => void logout().catch(showError));
  $("#transferClearButton").addEventListener("click", clearCompletedTransfers);
  $("#transferCollapseButton").addEventListener("click", toggleTransfersCollapsed);
  $("#viewToggleButton").addEventListener("click", toggleFileView);
  for (const toggleId of ["selectModeToggle", "imagesSelectModeToggle"]) {
    $(`#${toggleId}`)?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.selectionMode) {
        exitSelectionMode();
      } else {
        state.selectionMode = true;
        syncSelectionModeUi();
        syncSelectionBar();
      }
    });
  }
  for (const moveId of ["selectionMoveButton", "imagesSelectionMoveButton"]) {
    $(`#${moveId}`)?.addEventListener("click", (event) => {
      event.stopPropagation();
      void moveSelectedFiles().catch(showError);
    });
  }
  for (const deleteId of ["selectionDeleteButton", "imagesSelectionDeleteButton"]) {
    $(`#${deleteId}`)?.addEventListener("click", (event) => {
      event.stopPropagation();
      void deleteSelectedFiles().catch(showError);
    });
  }
  window.addEventListener("resize", () => {
    syncTouchChrome();
  });
  $("#backFolderButton").addEventListener("click", () => void goBackFolder().catch(showError));
  $$(".nav-item").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $("#langToggle").addEventListener("click", () => {
    state.lang = state.lang === "vi" ? "en" : "vi";
    localStorage.setItem("tg-drive-lang", state.lang);
    applyLanguage();
  });
  $("#refreshTrashButton").addEventListener("click", () => void loadTrash().catch(showError));
  $("#refreshImagesButton").addEventListener("click", () => void loadImages().catch(showError));
  $("#emptyTrashButton").addEventListener("click", () => void emptyTrash().catch(showError));
  $("#uploadButton").addEventListener("click", (event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    showContextMenu(rect.left, rect.bottom + 6, uploadMenuItems());
  });
  $("#fileInput").addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void uploadFiles(files).catch(showError);
  });
  $("#mediaInput").addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void uploadFiles(files).catch(showError);
  });
  $("#folderInput").addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void uploadFolderFiles(files).catch(showError);
  });
  window.addEventListener("dragenter", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    state.dragDepth++;
    $("#dropOverlay").classList.remove("hidden");
  });
  window.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  window.addEventListener("dragleave", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) {
      $("#dropOverlay").classList.add("hidden");
    }
  });
  window.addEventListener("drop", (event) => {
    if (event.dataTransfer?.types?.includes(INTERNAL_DRAG_TYPE)) return;
    if (!event.dataTransfer?.files?.length && !event.dataTransfer?.items?.length) return;
    event.preventDefault();
    state.dragDepth = 0;
    $("#dropOverlay").classList.add("hidden");
    void uploadDroppedItems(event.dataTransfer).catch(showError);
  });
  $("#searchAdvancedToggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const fields = $("#advancedSearchFields");
    const open = fields.classList.toggle("hidden");
    button.setAttribute("aria-expanded", String(!open));
  });
  $("#clearSearchButton").addEventListener("click", () => clearDriveSearch());
  $("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    void runSearch(event.currentTarget).catch(showError);
  });
  $("#retryAllButton").addEventListener("click", async () => {
    try {
      await api("/admin/queue/jobs/failed/retry?start=0&end=49", { method: "POST" });
      toast(t("retryDone"));
      await loadQueue();
    } catch (err) {
      showError(err);
    }
  });
  $("#queueStatsButton").addEventListener("click", () => void adminGet("/admin/queue/stats").catch(showError));
  $("#queueWorkersButton").addEventListener("click", () => void adminGet("/admin/queue/workers").catch(showError));
  $("#duplicatesButton").addEventListener("click", () => void adminGet("/admin/files/duplicates").catch(showError));
  $("#deleteDuplicatesButton").addEventListener("click", () => void deleteDuplicates().catch(showError));
  $("#reconcileDryRunButton").addEventListener("click", () => void runReconcile(true).catch(showError));
  $("#reconcileApplyButton").addEventListener("click", () => void runReconcile(false).catch(showError));
  $("#mysqlImportButton").addEventListener("click", () => $("#mysqlImportInput").click());
  $("#mysqlImportInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void importMysqlDump(file).catch(showError);
  });
  $("#accountsRefreshButton")?.addEventListener("click", () =>
    void loadAdminAccountsView().catch(showError),
  );
  $("#settingsSystemRefreshButton")?.addEventListener("click", () =>
    void loadRuntimeSettingsAdmin().catch(showError),
  );
  $$(".settings-admin-tab").forEach((btn) => {
    btn.addEventListener("click", () => setAdminSettingsTab(btn.dataset.adminSettingsTab));
  });
}

async function adminGet(path) {
  const data = await api(path);
  showAdminOutput(data);
}

async function deleteDuplicates() {
  const ok = await openConfirmModal({
    title: t("deleteDuplicates"),
    description: t("confirmDeleteDuplicates"),
  });
  if (!ok) return;
  const data = await api("/admin/files/duplicates/delete", { method: "POST" });
  showAdminOutput(data);
  toast(`${t("deleted")}: ${data.deleted || 0}`);
  await Promise.all([loadQuota(), loadDrive()]);
  if (state.view === "trash") await loadTrash();
}

async function runReconcile(dryRun) {
  if (
    !dryRun &&
    !(await openConfirmModal({
      title: t("reconcileApply"),
      description: t("confirmReconcile"),
    }))
  ) {
    return;
  }
  const data = await api("/admin/reconcile/files", {
    method: "POST",
    body: JSON.stringify({
      dryRun,
      batchSize: 50,
      maxTotal: 1000,
      delayMsBetweenChecks: 50,
    }),
  });
  showAdminOutput(data);
  await loadQuota().catch(() => undefined);
}

async function importMysqlDump(file) {
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  const result = await api("/admin/mysql/import", {
    method: "POST",
    body: form,
  });
  toast(t("imported"));
  showAdminOutput(result);
}

function showError(err) {
  toast(`${err.message || String(err)} · ${t("authHint")}`, { error: true });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated" && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      })
      .catch(() => undefined);
  });
}

async function init() {
  registerServiceWorker();
  if (!state.authToken) {
    const path = `${location.pathname}${location.search}${location.hash}`;
    window.location.replace(`/login.html?next=${encodeURIComponent(path || "/")}`);
    return;
  }
  restoreNavigationState();
  persistAuthCookie();
  if (state.authToken && !localStorage.getItem(AUTH_STORAGE_KEY)) {
    localStorage.setItem(AUTH_STORAGE_KEY, state.authToken);
  }
  wireEvents();
  try {
    await loadAppConfig();
    applyLanguage();
    setView(state.view, { persist: false, load: false });
    await restoreUploadTransfers();
    restoreActiveTransferSnapshots();
    void processUploadQueue().catch(showError);
    if (state.view === "images") {
      await Promise.all([loadQuota(), loadImages()]);
    } else {
      await Promise.all([loadQuota(), loadDrive()]);
    }
    if (state.searchActive) {
      await runSearch($("#searchForm"));
    }
    if (state.view === "trash") await loadTrash();
    if (state.view === "queue") await loadQueue();
    if (state.view === "settings") await loadSettingsView();
    if (state.view === "admin" && accountIsAdmin()) await loadRuntimeSettingsAdmin();
    if (state.view === "accounts" && accountIsAdmin()) await loadAdminAccountsView();
    persistNavigationState();
  } catch (err) {
    showError(err);
  }
}

void init();
