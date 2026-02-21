/**
 * Represents a cached value with an absolute expiration timestamp.
 */
interface CachedEntry<T> {
  data: T;
  cachedAtEpochMs: number;
  expiresAtEpochMs: number;
}

/**
 * Represents cache metadata returned with a cached value.
 */
export interface CacheHit<T> {
  data: T;
  cachedAtEpochMs: number;
  expiresAtEpochMs: number;
}

/**
 * Reads a cached value from browser local storage when it is still valid.
 */
export function readCache<T>(key: string): T | null {
  const hit = readCacheEntry<T>(key);
  return hit ? hit.data : null;
}

/**
 * Reads a cached value and returns its metadata when still valid.
 */
export function readCacheEntry<T>(key: string): CacheHit<T> | null {
  if (!isStorageAvailable()) {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  let parsed: CachedEntry<T>;
  try {
    parsed = JSON.parse(raw) as CachedEntry<T>;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }

  if (
    !parsed ||
    typeof parsed.expiresAtEpochMs !== 'number' ||
    typeof parsed.cachedAtEpochMs !== 'number'
  ) {
    window.localStorage.removeItem(key);
    return null;
  }

  if (Date.now() >= parsed.expiresAtEpochMs) {
    window.localStorage.removeItem(key);
    return null;
  }

  return {
    data: parsed.data,
    cachedAtEpochMs: parsed.cachedAtEpochMs,
    expiresAtEpochMs: parsed.expiresAtEpochMs
  };
}

/**
 * Stores a value in browser local storage with a TTL in seconds.
 */
export function writeCache<T>(key: string, data: T, ttlSeconds: number): void {
  if (!isStorageAvailable()) {
    return;
  }

  const safeTtlSeconds = Number.isFinite(ttlSeconds) ? Math.max(1, ttlSeconds) : 1;
  const entry: CachedEntry<T> = {
    data,
    cachedAtEpochMs: Date.now(),
    expiresAtEpochMs: Date.now() + safeTtlSeconds * 1000
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    return;
  }
}

/**
 * Removes one cached entry from browser local storage.
 */
export function deleteCache(key: string): void {
  if (!isStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(key);
}

/**
 * Returns whether local storage is available in the current runtime.
 */
function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
