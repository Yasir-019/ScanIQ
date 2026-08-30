/**
 * Scans a string and redacts any potential API keys, passwords, or tokens with [REDACTED].
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== "string") return text;
  let redacted = text;

  // Redact URL credentials https://user:pass@host -> https://[REDACTED]:[REDACTED]@host
  redacted = redacted.replace(
    /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:\s@/]+):([^@\s/]+)@/g,
    "$1[REDACTED_USER]:[REDACTED_SECRET]@"
  );

  // Redact API key key-value pairs
  redacted = redacted.replace(
    /(api[_-]?key|apikey|bearer|secret|token|password|auth[_-]?token)([\s:=]+["']?)([a-zA-Z0-9_\-.]{8,})(["']?)/gi,
    "$1$2[REDACTED_CREDENTIAL]$4"
  );

  return redacted;
}

/**
 * Deeply sanitizes an object tree to ensure no credentials or raw auth secrets exist.
 */
export function sanitizeObject<T>(obj: T): T {
  if (!obj || typeof obj !== "object") {
    if (typeof obj === "string") {
      return redactSecrets(obj) as unknown as T;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("key") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("password") ||
      lowerKey.includes("credential")
    ) {
      if (typeof value === "string" && value.length > 0) {
        // Redact secret value
        result[key] = "[REDACTED]";
        continue;
      }
    }
    result[key] = sanitizeObject(value);
  }

  return result as T;
}
