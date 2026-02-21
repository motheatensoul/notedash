/**
 * Defines in-app override settings for feed and status widgets.
 */
export interface RuntimeSettings {
  rssFeedUrls: string;
  uptimeKumaStatusUrl: string;
  refreshSeconds: number;
  rssCacheTtlSeconds: number;
  statusCacheTtlSeconds: number;
}

/**
 * Defines the local storage key for persisted runtime settings.
 */
export const RUNTIME_SETTINGS_STORAGE_KEY = 'notedash:runtime-settings:v1';

/**
 * Creates default runtime settings from public environment values.
 */
export function runtimeSettingsFromPublicEnv(
  publicEnv: Record<string, string | undefined>
): RuntimeSettings {
  return {
    rssFeedUrls: (publicEnv.PUBLIC_RSS_FEED_URLS ?? '').trim(),
    uptimeKumaStatusUrl: (publicEnv.PUBLIC_UPTIME_KUMA_STATUS_URL ?? '').trim(),
    refreshSeconds: parsePositiveInt(publicEnv.PUBLIC_FEED_STATUS_REFRESH_SECONDS, 180),
    rssCacheTtlSeconds: parsePositiveInt(publicEnv.PUBLIC_RSS_CACHE_TTL_SECONDS, 600),
    statusCacheTtlSeconds: parsePositiveInt(publicEnv.PUBLIC_STATUS_CACHE_TTL_SECONDS, 60)
  };
}

/**
 * Loads runtime settings from local storage with default fallback.
 */
export function loadRuntimeSettings(defaults: RuntimeSettings): RuntimeSettings {
  if (typeof window === 'undefined') {
    return defaults;
  }

  const raw = window.localStorage.getItem(RUNTIME_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RuntimeSettings>;
    return sanitizeRuntimeSettings(
      {
        rssFeedUrls: parsed.rssFeedUrls ?? defaults.rssFeedUrls,
        uptimeKumaStatusUrl: parsed.uptimeKumaStatusUrl ?? defaults.uptimeKumaStatusUrl,
        refreshSeconds: parsed.refreshSeconds ?? defaults.refreshSeconds,
        rssCacheTtlSeconds: parsed.rssCacheTtlSeconds ?? defaults.rssCacheTtlSeconds,
        statusCacheTtlSeconds: parsed.statusCacheTtlSeconds ?? defaults.statusCacheTtlSeconds
      },
      defaults
    );
  } catch {
    return defaults;
  }
}

/**
 * Persists runtime settings to local storage.
 */
export function saveRuntimeSettings(settings: RuntimeSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(RUNTIME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Sanitizes runtime settings values and applies numeric fallbacks.
 */
export function sanitizeRuntimeSettings(
  value: RuntimeSettings,
  fallback: RuntimeSettings = runtimeSettingsFromPublicEnv({})
): RuntimeSettings {
  return {
    rssFeedUrls: value.rssFeedUrls.trim(),
    uptimeKumaStatusUrl: value.uptimeKumaStatusUrl.trim(),
    refreshSeconds: parsePositiveInt(String(value.refreshSeconds), fallback.refreshSeconds),
    rssCacheTtlSeconds: parsePositiveInt(String(value.rssCacheTtlSeconds), fallback.rssCacheTtlSeconds),
    statusCacheTtlSeconds: parsePositiveInt(
      String(value.statusCacheTtlSeconds),
      fallback.statusCacheTtlSeconds
    )
  };
}

/**
 * Parses a positive integer from string input with fallback.
 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
