/**
 * Unified phone number normalization for the nestease-agent project.
 *
 * normalizePhone  — canonical 10-digit form (North American)
 * phoneVariants   — all plausible formats for DB matching
 * toE164          — E.164 format for sending SMS (+1XXXXXXXXXX)
 */

/**
 * Strip all non-digit characters, remove leading country code (+1 / 1),
 * and return the 10-digit local number.
 *
 * Examples:
 *   "+1 (604) 123-4567" → "6041234567"
 *   "16041234567"        → "6041234567"
 *   "604-123-4567"       → "6041234567"
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/**
 * Given a normalized 10-digit number, return every format that might
 * appear in the database so we can match with `.in("phone", variants)`.
 */
export function phoneVariants(normalized: string): string[] {
  return [`+1${normalized}`, `1${normalized}`, normalized];
}

/**
 * Format a phone number as E.164 for outbound SMS (Telnyx expects this).
 */
export function toE164(raw: string): string {
  const n = normalizePhone(raw);
  return `+1${n}`;
}
