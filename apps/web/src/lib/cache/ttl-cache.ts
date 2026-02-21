/**
 * Represents a cached value with an absolute expiration timestamp.
 */
interface CachedEntry<T> {
  data: T;
  expiresAtEpochMs: number;
}

/**
 * Reads a cached value from browser local storage when it is still valid.
 */
export function readCache<T>(key: string): T | null {
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

  if (!parsed || typeof parsed.expiresAtEpochMs !== 'number') {
    window.localStorage.removeItem(key);
    return null;
  }

  if (Date.now() >= parsed.expiresAtEpochMs) {
    window.localStorage.removeItem(key);
    return null;
  }

  return parsed.data;
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
    expiresAtEpochMs: Date.now() + safeTtlSeconds * 1000
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    return;
  }
}

/**
 * Returns whether local storage is available in the current runtime.
 */
function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
