import type { DashboardMonitor } from '@notedash/types';

/**
 * Defines Uptime Kuma status source settings.
 */
export interface UptimeKumaAdapterConfig {
  statusPageUrl: string;
}

/**
 * Represents a partial monitor shape returned by Uptime Kuma status endpoints.
 */
interface UptimeKumaMonitor {
  id?: number | string;
  name?: string;
  status?: number | string;
  ping?: number;
  responseTime?: number;
}

/**
 * Represents a grouped status payload from Uptime Kuma.
 */
interface UptimeKumaPublicGroup {
  monitorList?: UptimeKumaMonitor[];
}

/**
 * Represents the relevant fields in the Uptime Kuma status response.
 */
interface UptimeKumaStatusResponse {
  publicGroupList?: UptimeKumaPublicGroup[];
  publicMonitorList?: UptimeKumaMonitor[];
}

/**
 * Fetches service monitor state from Uptime Kuma.
 */
export async function fetchUptimeKumaStatus(
  config: UptimeKumaAdapterConfig
): Promise<DashboardMonitor[]> {
  const endpoints = buildStatusEndpoints(config.statusPageUrl);

  if (endpoints.length === 0) {
    return [];
  }

  let payload: UptimeKumaStatusResponse | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        continue;
      }

      payload = (await response.json()) as UptimeKumaStatusResponse;
      break;
    } catch {
      continue;
    }
  }

  if (!payload) {
    return [];
  }

  return normalizeStatusPayload(payload);
}

/**
 * Builds candidate status API endpoints from a user-supplied status page URL.
 */
function buildStatusEndpoints(statusPageUrl: string): string[] {
  const raw = statusPageUrl.trim();
  if (!raw) {
    return [];
  }

  if (raw.includes('/api/status-page/') || raw.endsWith('.json')) {
    return [raw];
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return [];
  }

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const slug = pathSegments[pathSegments.length - 1];
  if (!slug) {
    return [];
  }

  return [`${parsed.origin}/api/status-page/${slug}`];
}

/**
 * Normalizes Uptime Kuma response data into dashboard monitor rows.
 */
function normalizeStatusPayload(payload: UptimeKumaStatusResponse): DashboardMonitor[] {
  const grouped = payload.publicGroupList ?? [];
  const monitors = grouped.flatMap((group) => group.monitorList ?? []);
  const ungrouped = payload.publicMonitorList ?? [];
  const merged = [...monitors, ...ungrouped];

  const normalized = new Map<string, DashboardMonitor>();
  for (const monitor of merged) {
    const name = monitor.name?.trim();
    if (!name) {
      continue;
    }

    const id = monitor.id == null ? name : String(monitor.id);
    normalized.set(id, {
      id,
      name,
      state: normalizeMonitorState(monitor.status),
      latencyMs: normalizeLatency(monitor)
    });
  }

  return [...normalized.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Normalizes Uptime Kuma status values into dashboard monitor states.
 */
function normalizeMonitorState(status: UptimeKumaMonitor['status']): DashboardMonitor['state'] {
  const value = typeof status === 'string' ? Number.parseInt(status, 10) : status;
  if (value === 1) {
    return 'up';
  }

  if (value === 0) {
    return 'down';
  }

  return 'degraded';
}

/**
 * Selects the most representative latency value from a monitor entry.
 */
function normalizeLatency(monitor: UptimeKumaMonitor): number | undefined {
  const candidate = monitor.ping ?? monitor.responseTime;
  if (typeof candidate !== 'number' || Number.isNaN(candidate)) {
    return undefined;
  }

  return Math.round(candidate);
}
