/* eslint-disable no-control-regex */
/**
 * ScanIQ Security Module
 * Strict input validations, sanitizations, and protocol whitelisting.
 */

/**
 * Validates that a string is a safe web URL (http or https protocol only).
 */
export function validateWebUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates that a string is a safe payment URL/scheme (http, https, or upi).
 */
export function validatePaymentUrl(urlStr: string): boolean {
  try {
    const trimmed = urlStr.trim();
    if (/^upi:\/\//i.test(trimmed)) {
      // Basic upi structure check
      const parsed = new URL(trimmed);
      return parsed.protocol === "upi:";
    }
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Sanitizes user/scan input to avoid control characters, script tags,
 * and limits max length to protect layout rendering from overflows.
 */
export function sanitizeInput(input: string, maxLength: number = 2048): string {
  if (!input) return "";
  let clean = input.trim();
  
  // Enforce absolute maximum content length to prevent browser freeze/memory overflow
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }

  // Strip control characters (except common spaces, newlines, and tabs)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");

  // Prevent basic HTML element injections
  clean = clean
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return clean;
}
