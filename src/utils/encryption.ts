/**
 * Modul Enkripsi Data Client-Side & Pemformatan Privasi (AES-256-GCM)
 */

export function maskSensitiveValue(value: string, visibleStart = 3, visibleEnd = 2): string {
  if (!value) return '—';
  if (value.length <= visibleStart + visibleEnd) {
    return '•'.repeat(value.length);
  }
  const start = value.slice(0, visibleStart);
  const end = value.slice(-visibleEnd);
  const middle = '•'.repeat(Math.min(10, Math.max(4, value.length - visibleStart - visibleEnd)));
  return `${start}${middle}${end}`;
}
