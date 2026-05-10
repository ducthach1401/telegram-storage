const API = "/api/v1";
const ROOT = "root";
const INTERNAL_DRAG_TYPE = "application/x-telegram-drive-item";
const AUTH_STORAGE_KEY = "tg-drive-basic-auth";
const VIEW_STORAGE_KEY = "tg-drive-file-view";
const NAV_STORAGE_KEY = "tg-drive-nav-state";
const PREVIEW_CACHE_NAME = "tg-drive-preview-cache-v1";
const UPLOAD_DB_NAME = "tg-drive-upload-queue";
const UPLOAD_STORE_NAME = "uploads";
const UPLOAD_RETRY_DELAY_MS = 15000;
const objectUrlCache = new Map();

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
    loginHint: "Nhập Basic Auth trong file .env. Phiên đăng nhập sẽ được lưu cho tới khi bạn bấm đăng xuất.",
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
    search: "Tìm kiếm",
    trash: "Thùng rác",
    queue: "Queue lỗi",
    admin: "Admin/API",
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
    rename: "Đổi tên file",
    move: "Di chuyển file",
    info: "Thông tin file",
    thumb: "Thumb",
    rightClickHint: "Click phải để mở menu",
    open: "Mở",
    openFile: "Mở file",
    download: "Tải file",
    share: "Chia sẻ file",
    tags: "Gắn tag file",
    delete: "Xóa file",
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
    authHint: "Nếu API hỏi đăng nhập, dùng Basic Auth trong file .env.",
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
    loginHint: "Enter Basic Auth from .env. The session is saved until you log out.",
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
    search: "Search",
    trash: "Trash",
    queue: "Failed queue",
    admin: "Admin/API",
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
    rename: "Rename file",
    move: "Move file",
    info: "File info",
    thumb: "Thumb",
    rightClickHint: "Right click for menu",
    open: "Open",
    openFile: "Open file",
    download: "Download file",
    share: "Share file",
    tags: "Edit file tags",
    delete: "Delete file",
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
    authHint: "If the API asks for login, use Basic Auth from .env.",
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
  authToken: localStorage.getItem(AUTH_STORAGE_KEY),
  authPromptPromise: null,
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
  transferCollapsed: false,
  transferAutoClearTimer: null,
  uploadProcessing: false,
  uploadRetryTimer: null,
  maxUploadBytes: 50 * 1024 * 1024 * 1024,
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

function formatSpeed(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
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
  return id;
}

function updateTransfer(id, patch) {
  const item = state.transfers.get(id);
  if (!item) return;
  Object.assign(item, patch);
  renderTransfers();
  scheduleTransferAutoClear();
}

function finishTransfer(id, status = t("done")) {
  updateTransfer(id, { loaded: state.transfers.get(id)?.total || 1, status, speed: 0, cancelable: false });
}

function isActiveTransfer(item) {
  return item.cancelable || item.error || item.status !== t("done");
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
  }, 1200);
}

function renderTransfers() {
  const panel = $("#transferPanel");
  const list = $("#transferList");
  const collapseButton = $("#transferCollapseButton");
  const items = [...state.transfers.values()].slice(-8).reverse();
  panel.classList.toggle("hidden", items.length === 0);
  panel.classList.toggle("collapsed", state.transferCollapsed);
  collapseButton.textContent = state.transferCollapsed ? "+" : "−";
  list.innerHTML = "";
  items.forEach((item) => {
    const pct = item.total > 0 ? Math.min(100, Math.round((item.loaded / item.total) * 100)) : 0;
    const sizeText = item.total > 0 ? `${formatBytes(item.loaded)}/${formatBytes(item.total)}` : formatBytes(item.loaded);
    const speedText = item.speed ? formatSpeed(item.speed) : "--/s";
    const row = document.createElement("div");
    row.className = `transfer-item ${item.error ? "error" : ""}`;
    row.innerHTML = `
      <div class="transfer-title">
        <span class="transfer-name">${escapeHtml(item.name)}</span>
        <span class="transfer-meta">${pct || 0}% · ${speedText}</span>
      </div>
      <div class="transfer-detail">
        <span class="muted">${sizeText} · ${escapeHtml(item.status)}</span>
      </div>
      <div class="transfer-progress"><span style="width:${pct}%"></span></div>
    `;
    if (item.cancelable) {
      const detail = row.querySelector(".transfer-detail");
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

async function getAllUploadRecords() {
  const store = await uploadStore("readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueUpload(file, folderId = state.folderId) {
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
    updateTransfer(record.id, {
      status: record.status === "uploading" ? t("queued") : t("queued"),
      loaded: 0,
      total: record.file?.size || 0,
      speed: 0,
      cancelable: true,
    });
  });
}

async function processUploadQueue() {
  if (state.uploadProcessing) return;
  if (state.uploadRetryTimer) {
    clearTimeout(state.uploadRetryTimer);
    state.uploadRetryTimer = null;
  }
  state.uploadProcessing = true;
  try {
    while (true) {
      const now = Date.now();
      const records = (await getAllUploadRecords()).sort((a, b) => a.createdAt - b.createdAt);
      const record = records.find((item) => !item.retryAfter || item.retryAfter <= now);
      if (!record && records.length) {
        const nextRetryAt = Math.min(...records.map((item) => item.retryAfter || now));
        scheduleUploadQueue(Math.max(1000, nextRetryAt - now));
        return;
      }
      if (!record) return;
      record.status = "uploading";
      await putUploadRecord(record);
      updateTransfer(record.id, { status: t("uploading"), loaded: 0, total: record.file.size, speed: 0, cancelable: true, error: false });
      try {
        const queued = await uploadFileRecord(record);
        updateTransfer(record.id, { status: t("processing"), speed: 0, error: false, cancelable: false });
        await watchUploadJob(queued.jobId, record.id);
        await deleteUploadRecord(record.id);
      } catch (err) {
        if (isTransferCanceled(err)) {
          await deleteUploadRecord(record.id);
          continue;
        }
        record.status = "queued";
        record.createdAt = Date.now();
        record.retryAfter = Date.now() + UPLOAD_RETRY_DELAY_MS;
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
  if (state.uploadRetryTimer) {
    clearTimeout(state.uploadRetryTimer);
  }
  state.uploadRetryTimer = setTimeout(() => {
    state.uploadRetryTimer = null;
    void processUploadQueue().catch(showError);
  }, delayMs);
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
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
  toast(t("loginInvalid"));
  return ensureAuth();
}

function persistAuthCookie() {
  if (!state.authToken) return;
  document.cookie = `tg_drive_auth=${encodeURIComponent(state.authToken)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function ensureAuth() {
  if (state.authToken) return Promise.resolve(state.authToken);
  if (state.authPromptPromise) return state.authPromptPromise;
  state.authPromptPromise = new Promise((resolve) => {
    const backdrop = $("#authBackdrop");
    const form = $("#authModal");
    const user = $("#authUser");
    const pass = $("#authPass");
    backdrop.classList.remove("hidden");
    form.onsubmit = async (event) => {
      event.preventDefault();
      const token = btoa(`${user.value}:${pass.value}`);
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      const ok = await verifyAuthToken(token).catch(() => false);
      submit.disabled = false;
      if (!ok) {
        toast(t("loginInvalid"));
        pass.select();
        return;
      }
      state.authToken = token;
      localStorage.setItem(AUTH_STORAGE_KEY, token);
      persistAuthCookie();
      pass.value = "";
      backdrop.classList.add("hidden");
      state.authPromptPromise = null;
      resolve(token);
    };
    setTimeout(() => user.focus(), 0);
  });
  return state.authPromptPromise;
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
}

async function loadAppConfig() {
  const data = await api("/auth/verify");
  applyAppConfig(data);
}

function logout() {
  clearAuth();
  location.reload();
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
}

function setView(view, opts = {}) {
  if (!["drive", "trash", "queue", "admin"].includes(view)) {
    view = "drive";
  }
  state.view = view;
  $$(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  ["drive", "trash", "queue", "admin"].forEach((name) => {
    $(`#${name}View`)?.classList.toggle("hidden", name !== view);
  });
  if (opts.persist !== false) {
    persistNavigationState();
  }
  if (opts.load !== false) {
    if (view === "trash") void loadTrash();
    if (view === "queue") void loadQueue();
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
  if (["drive", "trash", "queue", "admin"].includes(source.view)) {
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
    view: state.view,
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
    clearFileSelection();
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

function folderCardMenuItems(folder) {
  return [
    { label: t("open"), handler: () => navigateToFolder(folder.id, folder.name) },
    { label: t("downloadZip"), handler: () => downloadFolderZip(folder.id) },
    { label: t("copyFolder"), handler: () => copyFolder(folder.id) },
    {
      label: t("deleteFolder"),
      variant: "danger",
      handler: () => deleteFolder(folder.id, folder.name),
    },
  ];
}

function fileMenuItems(file) {
  return [
    { label: t("openFile"), handler: () => openFilePreview(file) },
    { label: t("download"), handler: () => downloadFile(file) },
    { label: t("share"), handler: () => createShare(file.id) },
    { label: t("tags"), handler: () => editTags(file) },
    { label: t("rename"), handler: () => renameFile(file) },
    { label: t("move"), handler: () => moveFile(file) },
    { label: t("info"), handler: () => showFileInfo(file.id) },
    ...(file.thumbnailTelegramFileId
      ? [{ label: t("thumb"), handler: () => openThumbnailPreview(file) }]
      : []),
    {
      label: t("delete"),
      variant: "danger",
      handler: async () => {
        await api(`/files/${file.id}`, { method: "DELETE" });
        toast(t("deleted"));
        await Promise.all([loadDrive(), loadQuota()]);
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
  const bar = $("#selectionBar");
  if (!bar) return;
  const count = selectedItemCount();
  bar.classList.toggle("hidden", count < 2);
  $("#selectionCount").textContent = `${count} ${t("selectedItems")}`;
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
  return type === "folder" ? folderCardMenuItems(item) : fileMenuItems(item);
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
  if (mode === "trash" || (mode !== "drive" || !state.searchActive)) {
    state.visibleFiles = files;
  }
  if (mode !== "trash" && (mode !== "drive" || !state.searchActive)) {
    pruneSelectedFiles(files);
  }
  list.innerHTML = "";
  list.classList.toggle("grid-view", state.fileView === "grid");
  list.classList.toggle("list-view", state.fileView !== "grid");
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
    row.innerHTML = `
      <div class="file-main">
        <span class="file-thumb" data-file-id="${escapeHtml(file.id)}">${fileIcon(file)}</span>
        <div class="file-title">
          <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
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
        { label: t("openFile"), handler: () => openFilePreview(file) },
        { label: t("download"), handler: () => downloadFile(file) },
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
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `context-item ${item.variant || ""}`;
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
  $("#viewerDownloadButton").onclick = () => void downloadWithAuth(downloadUrl, file.name).catch(showError);
  body.innerHTML = "";
  $("#viewerBackdrop").classList.remove("hidden");
  syncViewerNav();

  if (file.mimeType?.startsWith("image/")) {
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
  const btn = actionButton(t("download"), "", () => downloadWithAuth(downloadUrl, file.name));
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
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;

  const applyZoom = () => {
    img.style.transform = `scale(${zoom})`;
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
  stage.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 2) return;
      pinchStartDistance = touchDistance(event.touches);
      pinchStartZoom = zoom;
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length !== 2 || !pinchStartDistance) return;
      event.preventDefault();
      setZoom(pinchStartZoom * (touchDistance(event.touches) / pinchStartDistance));
    },
    { passive: false },
  );
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
  $("#viewerBackdrop").classList.remove("hidden");
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
    await downloadWithAuth(fileDownloadUrl(file), file.name);
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

async function downloadWithAuth(url, filename) {
  const transferId = createTransfer("download", filename || "download");
  const controller = new AbortController();
  state.transferAborters.set(transferId, () => controller.abort());
  updateTransfer(transferId, { cancelable: true });
  try {
    const res = await fetchWithAuth(url, { signal: controller.signal });
    if (!res.ok) {
      updateTransfer(transferId, { status: `HTTP ${res.status}`, error: true, cancelable: false });
      throw new Error(`${res.status}: ${res.statusText}`);
    }
    const total = Number(res.headers.get("content-length") || 0);
    const reader = res.body?.getReader();
    const chunks = [];
    let loaded = 0;
    let lastLoaded = 0;
    let lastTime = performance.now();
    if (reader) {
      const startedAt = performance.now();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        const now = performance.now();
        const elapsed = Math.max(1, now - lastTime) / 1000;
        const instantSpeed = (loaded - lastLoaded) / elapsed;
        const averageSpeed = loaded / Math.max(0.001, (now - startedAt) / 1000);
        const speed = instantSpeed || averageSpeed;
        lastLoaded = loaded;
        lastTime = now;
        updateTransfer(transferId, { loaded, total, speed });
      }
    } else {
      chunks.push(new Uint8Array(await res.arrayBuffer()));
      loaded = chunks[0].byteLength;
    }
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
    throw err;
  } finally {
    state.transferAborters.delete(transferId);
  }
}

function closeFilePreview() {
  state.previewToken++;
  $("#viewerBackdrop").classList.add("hidden");
  $("#viewerBody").innerHTML = "";
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
  $("#viewerBackdrop").classList.remove("hidden");
  const img = document.createElement("img");
  img.src = fileThumbnailUrl(file);
  img.alt = file.name;
  body.appendChild(img);
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

async function loadQuota() {
  const quota = await api("/files/quota");
  $("#quotaTotal").textContent = `${formatBytes(quota.totalBytes)} / ${t("unlimited")}`;
  $("#quotaBar").style.width = quota.totalBytes > 0 ? "100%" : "8%";
  const minioBytes = Number(quota.minioBytes || 0);
  const minioLimitBytes = Number(quota.minioLimitBytes || 50 * 1024 * 1024 * 1024);
  $("#minioQuotaDetail").textContent = `${formatBytes(minioBytes)} / ${formatBytes(minioLimitBytes)}`;
  $("#minioQuotaBar").style.width = `${Math.min(100, Math.max(4, (minioBytes / (minioLimitBytes || 1)) * 100))}%`;
}

async function loadDrive() {
  renderBreadcrumbs();
  syncFolderActions();
  const data = await api(`/folders/${encodeURIComponent(state.folderId)}/contents?fileLimit=200&folderLimit=200`);
  renderFolders(data.folders || []);
  renderFileList("#fileList", data.files || []);
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
  const form = new FormData();
  form.append("file", record.file, record.fileName);
  if (record.folderId && record.folderId !== ROOT) form.append("folderId", record.folderId);
  const queued = await uploadWithProgress(
    "/files/upload/async?duplicatePolicy=suffix",
    form,
    record.file,
    record.id,
  );
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
      const now = performance.now();
      const elapsed = Math.max(1, now - lastTime) / 1000;
      const instantSpeed = (event.loaded - lastLoaded) / elapsed;
      const averageSpeed = event.loaded / Math.max(0.001, (now - state.transfers.get(transferId).startedAt) / 1000);
      const speed = instantSpeed || averageSpeed;
      lastLoaded = event.loaded;
      lastTime = now;
      updateTransfer(transferId, {
        loaded: event.loaded,
        total: event.total || file.size,
        speed,
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
  const list = Array.from(files || []).filter((file) => file && file.size >= 0);
  let queued = 0;
  for (const file of list) {
    if (await enqueueUpload(file, state.folderId)) queued++;
  }
  if (queued > 0) {
    void processUploadQueue().catch(showError);
  }
}

async function uploadFileToFolder(file, folderId) {
  if (!file) return;
  await enqueueUpload(file, folderId);
}

async function uploadFolderFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.webkitRelativePath);
  if (!files.length) return;
  const firstPath = files[0].webkitRelativePath;
  const rootName = firstPath.split("/")[0] || "folder";
  const entries = files.map((file) => ({
    file,
    relativePath: file.webkitRelativePath.split("/").slice(1).join("/") || file.name,
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
  const validEntries = [];
  let skipped = 0;
  for (const entry of entries) {
    if (canUploadFile(entry.file)) {
      validEntries.push(entry);
    } else {
      skipped++;
    }
  }
  if (!validEntries.length) return;
  const rootFolder = await resolveRootUploadFolder(rootName);
  const folderMap = new Map([["", rootFolder.id]]);
  const queuedUploads = [];

  for (const entry of validEntries) {
    const parts = entry.relativePath.split("/").filter(Boolean);
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
  await Promise.all([loadDrive(), loadQuota()]);
}

async function uploadDroppedItems(dataTransfer) {
  const looseFiles = [];
  const items = Array.from(dataTransfer.items || []);
  for (const item of items) {
    const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
    if (entry?.isDirectory) {
      const files = await readDirectoryEntry(entry);
      await uploadFolderEntries(entry.name, files);
    } else if (entry?.isFile) {
      looseFiles.push(await readFileEntry(entry));
    } else {
      const file = item.getAsFile?.();
      if (file) looseFiles.push(file);
    }
  }

  if (!items.length) {
    looseFiles.push(...Array.from(dataTransfer.files || []));
  }

  if (looseFiles.length) {
    await uploadFiles(looseFiles);
  }
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

async function watchUploadJob(jobId, transferId) {
  for (let attempt = 0; attempt < 25; attempt++) {
    await delay(attempt < 4 ? 1000 : 2500);
    const status = await api(`/files/upload/jobs/${encodeURIComponent(jobId)}`);
    if (status.state === "completed") {
      finishTransfer(transferId, t("done"));
      toast(t("uploadCompleted"));
      await Promise.all([loadDrive(), loadQuota()]);
      return;
    }
    if (status.state === "failed") {
      updateTransfer(transferId, { status: status.failedReason || t("uploadFailed"), error: true, speed: 0 });
      toast(`${t("uploadFailed")}: ${status.failedReason || jobId}`);
      await loadQueue().catch(() => undefined);
      return;
    }
  }
  await loadQueue().catch(() => undefined);
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
    await loadDrive();
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
  await loadDrive();
}

async function showFileInfo(fileId) {
  const [meta, tags] = await Promise.all([
    api(`/files/${fileId}`),
    api(`/files/${fileId}/tags`),
  ]);
  showAdminOutput({ meta, tags });
  setView("admin");
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
  window.addEventListener("click", hideContextMenu);
  window.addEventListener("scroll", hideContextMenu, true);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideContextMenu();
      closeFilePreview();
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
    if (event.target === event.currentTarget) closeFilePreview();
  });
  $("#logoutButton").addEventListener("click", logout);
  $("#transferClearButton").addEventListener("click", clearCompletedTransfers);
  $("#transferCollapseButton").addEventListener("click", toggleTransfersCollapsed);
  $("#viewToggleButton").addEventListener("click", toggleFileView);
  $("#backFolderButton").addEventListener("click", () => void goBackFolder().catch(showError));
  $$(".nav-item").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $("#langToggle").addEventListener("click", () => {
    state.lang = state.lang === "vi" ? "en" : "vi";
    localStorage.setItem("tg-drive-lang", state.lang);
    applyLanguage();
  });
  $("#refreshTrashButton").addEventListener("click", () => void loadTrash().catch(showError));
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
  toast(`${err.message || String(err)} · ${t("authHint")}`);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

async function init() {
  registerServiceWorker();
  restoreNavigationState();
  applyLanguage();
  persistAuthCookie();
  wireEvents();
  setView(state.view, { persist: false, load: false });
  try {
    await loadAppConfig();
    await restoreUploadTransfers();
    void processUploadQueue().catch(showError);
    await Promise.all([loadQuota(), loadDrive()]);
    if (state.searchActive) {
      await runSearch($("#searchForm"));
    }
    if (state.view === "trash") await loadTrash();
    if (state.view === "queue") await loadQueue();
    persistNavigationState();
  } catch (err) {
    showError(err);
  }
}

void init();
