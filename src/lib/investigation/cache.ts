export interface CachedResult<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  ageSeconds: number;
  ttlSeconds: number;
}

export interface CacheEntry<T> {
  target: string;
  providerId: string;
  timestamp: number;
  expiresAt: number;
  ttlSeconds: number;
  data: T;
}

/**
 * Default TTL values in seconds for intelligence categories.
 */
export const DEFAULT_PROVIDER_TTLS: Record<string, number> = {
  "dns-over-https": 300, // 5 minutes (DNS record caching)
  "rdap-domain": 3600, // 1 hour (Registration data)
  "rdap-ip": 3600, // 1 hour (IP allocation data)
  "ipinfo": 86400, // 24 hours (ASN / Geolocation)
  "crtsh-cert": 7200, // 2 hours
};

const DEFAULT_FALLBACK_TTL = 3600; // 1 hour
const MAX_CACHE_ENTRIES = 500;

export class IntelligenceCache {
  private static store = new Map<string, CacheEntry<unknown>>();

  private static makeKey(providerId: string, targetValue: string): string {
    return `${providerId.toLowerCase()}::${targetValue.toLowerCase().trim()}`;
  }

  /**
   * Retrieves a cached value if present and not expired.
   */
  public static get<T>(providerId: string, targetValue: string): CachedResult<T> | null {
    const key = this.makeKey(providerId, targetValue);
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh position for LRU
    this.store.delete(key);
    this.store.set(key, entry);

    const ageSeconds = Math.max(0, Math.floor((now - entry.timestamp) / 1000));

    return {
      data: entry.data,
      cachedAt: entry.timestamp,
      expiresAt: entry.expiresAt,
      ageSeconds,
      ttlSeconds: entry.ttlSeconds,
    };
  }

  /**
   * Stores a result with TTL.
   */
  public static set<T>(
    providerId: string,
    targetValue: string,
    data: T,
    ttlSeconds?: number,
  ): void {
    const effectiveTtl = ttlSeconds ?? DEFAULT_PROVIDER_TTLS[providerId] ?? DEFAULT_FALLBACK_TTL;
    const now = Date.now();
    const expiresAt = now + effectiveTtl * 1000;

    const key = this.makeKey(providerId, targetValue);

    // Evict oldest if capacity exceeded
    if (this.store.size >= MAX_CACHE_ENTRIES && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      target: targetValue,
      providerId,
      timestamp: now,
      expiresAt,
      ttlSeconds: effectiveTtl,
      data,
    });
  }

  /**
   * Checks if a non-expired entry exists.
   */
  public static has(providerId: string, targetValue: string): boolean {
    return this.get(providerId, targetValue) !== null;
  }

  /**
   * Clears all cache entries or entries for a specific provider.
   */
  public static clear(providerId?: string): void {
    if (!providerId) {
      this.store.clear();
      return;
    }

    const prefix = `${providerId.toLowerCase()}::`;
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Gets current count of cached items.
   */
  public static size(): number {
    return this.store.size;
  }
}
