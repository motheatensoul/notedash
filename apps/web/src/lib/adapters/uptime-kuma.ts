import type { DashboardMonitor } from '@notedash/types';

/**
 * Defines Uptime Kuma status source settings.
 */
export interface UptimeKumaAdapterConfig {
  statusPageUrl: string;
}

/**
 * Fetches service monitor state from Uptime Kuma.
 *
 * This first-step implementation intentionally returns an empty list until
 * endpoint parsing is implemented.
 */
export async function fetchUptimeKumaStatus(
  _config: UptimeKumaAdapterConfig
): Promise<DashboardMonitor[]> {
  return [];
}
