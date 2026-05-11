/** Hoàn nguyên UTF-8 khi busboy/multer đọc filename multipart thành latin-1. */
export function repairUtf8FilenameMojibake(name: string): string {
  if (!name) return name;
  if (/[^\u0000-\u00ff]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}
