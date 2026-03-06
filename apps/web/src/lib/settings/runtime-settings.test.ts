import { describe, expect, test } from 'bun:test';
import {
  runtimeSettingsFromPublicEnv,
  sanitizeRuntimeSettings,
  type RuntimeSettings
} from './runtime-settings';

/**
 * Creates a valid runtime settings object for test overrides.
 */
function makeSettings(partial: Partial<RuntimeSettings> = {}): RuntimeSettings {
  return {
    rssFeedUrls: 'https://hnrss.org/frontpage',
    uptimeKumaStatusUrl: 'https://status.example.com/status/main',
    refreshSeconds: 180,
    rssCacheTtlSeconds: 600,
    statusCacheTtlSeconds: 60,
    ...partial
  };
}

describe('runtimeSettingsFromPublicEnv', () => {
  test('maps public env values and numeric fallbacks', () => {
    const settings = runtimeSettingsFromPublicEnv({
      PUBLIC_RSS_FEED_URLS: 'https://a.example/rss.xml',
      PUBLIC_UPTIME_KUMA_STATUS_URL: 'https://status.example.com/status/main',
      PUBLIC_FEED_STATUS_REFRESH_SECONDS: '240',
      PUBLIC_RSS_CACHE_TTL_SECONDS: '900',
      PUBLIC_STATUS_CACHE_TTL_SECONDS: '120'
    });

    expect(settings.rssFeedUrls).toBe('https://a.example/rss.xml');
    expect(settings.refreshSeconds).toBe(240);
    expect(settings.rssCacheTtlSeconds).toBe(900);
    expect(settings.statusCacheTtlSeconds).toBe(120);
  });
});

describe('sanitizeRuntimeSettings', () => {
  test('trims string values and keeps valid numbers', () => {
    const sanitized = sanitizeRuntimeSettings(
      makeSettings({
        rssFeedUrls: '  https://a.example/rss.xml  ',
        uptimeKumaStatusUrl: '  https://status.example.com/main  '
      })
    );

    expect(sanitized.rssFeedUrls).toBe('https://a.example/rss.xml');
    expect(sanitized.uptimeKumaStatusUrl).toBe('https://status.example.com/main');
  });

  test('falls back for invalid numeric values', () => {
    const fallback = makeSettings({ refreshSeconds: 300, rssCacheTtlSeconds: 700, statusCacheTtlSeconds: 80 });
    const malformed = makeSettings({
      refreshSeconds: Number.NaN,
      rssCacheTtlSeconds: Number.NEGATIVE_INFINITY,
      statusCacheTtlSeconds: 0
    });

    const sanitized = sanitizeRuntimeSettings(malformed, fallback);
    expect(sanitized.refreshSeconds).toBe(300);
    expect(sanitized.rssCacheTtlSeconds).toBe(700);
    expect(sanitized.statusCacheTtlSeconds).toBe(80);
  });
});
