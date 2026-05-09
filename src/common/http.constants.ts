/** Header / MIME / chế độ HTTP dùng trong runtime (không phải mô tả Swagger). */
export const HttpHeader = {
  CONTENT_TYPE: 'Content-Type',
  CONTENT_DISPOSITION: 'Content-Disposition',
  CACHE_CONTROL: 'Cache-Control',
  WWW_AUTHENTICATE: 'WWW-Authenticate',
} as const;

/** Express lowercases header keys khi đọc `req.headers`. */
export const HttpIncomingHeader = {
  AUTHORIZATION: 'authorization',
} as const;

export const HttpAuthScheme = {
  BASIC_PREFIX: 'Basic ',
} as const;

export const HttpMethod = {
  OPTIONS: 'OPTIONS',
} as const;

export const MimeType = {
  OCTET_STREAM: 'application/octet-stream',
  APPLICATION_ZIP: 'application/zip',
  JPEG: 'image/jpeg',
  TEXT_PLAIN_UTF8: 'text/plain; charset=utf-8',
} as const;

export const CacheControlValue = {
  PUBLIC_DAY: 'public, max-age=86400',
} as const;

export const ContentDispositionMode = {
  INLINE: 'inline',
  ATTACHMENT: 'attachment',
} as const;

export const BasicAuthWwwAuthenticateValue = 'Basic realm="Telegram Storage API"';

export const ProcessLifecycleSignal = {
  PM2_READY: 'ready',
} as const;

export const BufferEncoding = {
  UTF8: 'utf8',
  BASE64: 'base64',
} as const;
