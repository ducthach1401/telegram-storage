/** RFC 5987 — header Content-Disposition cho stream file */
export function contentDispositionHeader(
  mode: 'inline' | 'attachment',
  name: string,
): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_');
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
