import type { DashboardMonitor } from '@notedash/types';

/**
 * Defines Uptime Kuma status source settings.
 */
export interface UptimeKumaAdapterConfig {
  statusPageUrl: string;
}

/**
 * Defines status adapter output with optional diagnostics.
 */
export interface UptimeKumaFetchResult {
  monitors: DashboardMonitor[];
  errorDetail?: string;
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
 * Represents the heartbeat endpoint response from Uptime Kuma.
 * `uptimeList` keys are `"<monitorId>_24"` (24 h) and `"<monitorId>_720"` (30 d).
 */
interface UptimeKumaHeartbeatResponse {
  uptimeList?: Record<string, number>;
}

interface DesktopUptimeResponse {
  status: number;
  body: string;
}

const UPTIME_KUMA_REQUEST_TIMEOUT_MS = 15000;

/**
 * Detects whether the current runtime is a Tauri WebView.
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
}

/**
 * Fetches service monitor state from Uptime Kuma.
 */
export async function fetchUptimeKumaStatus(
  config: UptimeKumaAdapterConfig
): Promise<DashboardMonitor[]> {
  const result = await fetchUptimeKumaStatusDetailed(config);
  return result.monitors;
}

/**
 * Fetches service monitor data and includes optional diagnostic detail.
 */
export async function fetchUptimeKumaStatusDetailed(
  config: UptimeKumaAdapterConfig
): Promise<UptimeKumaFetchResult> {
  const endpoints = buildStatusEndpoints(config.statusPageUrl);

  if (endpoints.length === 0) {
    return { monitors: [] };
  }

  let payload: UptimeKumaStatusResponse | null = null;
  let lastError: string | undefined;

  for (const endpoint of endpoints) {
    try {
      const response = await requestStatusEndpoint(endpoint);
      if (!response) {
        lastError = `${endpoint} (network timeout/error)`;
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        lastError = `${endpoint} (HTTP ${response.status})`;
        continue;
      }

      payload = JSON.parse(response.body) as UptimeKumaStatusResponse;
      break;
    } catch {
      lastError = `${endpoint} (network or parsing error)`;
      continue;
    }
  }

  if (!payload) {
    return {
      monitors: [],
      errorDetail: lastError ? `Status endpoint failed: ${lastError}` : 'Status endpoint failed'
    };
  }

  const monitors = normalizeStatusPayload(payload);
  if (monitors.length === 0) {
    return {
      monitors,
      errorDetail: 'Status endpoint responded but no monitor entries were found'
    };
  }

  // Best-effort heartbeat fetch for 24 h uptime ratios — failures are non-fatal.
  const heartbeatEndpoint = buildHeartbeatEndpoint(config.statusPageUrl);
  if (heartbeatEndpoint) {
    try {
      const hbResponse = await requestStatusEndpoint(heartbeatEndpoint);
      if (hbResponse && hbResponse.status >= 200 && hbResponse.status < 300) {
        const hbPayload = JSON.parse(hbResponse.body) as UptimeKumaHeartbeatResponse;
        applyUptimeRatios(monitors, hbPayload.uptimeList ?? {});
      }
    } catch {
      // heartbeat failure is non-fatal — monitors still render without uptime %
    }
  }

  return { monitors };
}

/**
 * Requests a status endpoint through desktop bridge when available.
 */
async function requestStatusEndpoint(endpoint: string): Promise<DesktopUptimeResponse | null> {
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await Promise.race([
        invoke<DesktopUptimeResponse>('desktop_uptime_kuma_request', {
          url: endpoint
        }),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            resolve(null);
          }, UPTIME_KUMA_REQUEST_TIMEOUT_MS);
        })
      ]);
    } catch {
      return null;
    }
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => {
    controller?.abort();
  }, UPTIME_KUMA_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      signal: controller?.signal
    });
    return {
      status: response.status,
      body: await response.text()
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
 * Derives the heartbeat endpoint URL from a status page URL.
 * Returns `null` if the slug cannot be determined.
 */
function buildHeartbeatEndpoint(statusPageUrl: string): string | null {
  const raw = statusPageUrl.trim();
  if (!raw) return null;

  // If the URL is already an API path, derive heartbeat alongside it.
  const apiMatch = raw.match(/^(https?:\/\/.+?)\/api\/status-page\/([^/?#]+)/);
  if (apiMatch) {
    return `${apiMatch[1]}/api/status-page/heartbeat/${apiMatch[2]}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const slug = segments[segments.length - 1];
  if (!slug) return null;

  return `${parsed.origin}/api/status-page/heartbeat/${slug}`;
}

/**
 * Merges 24-hour uptime ratios from the heartbeat payload into monitor entries.
 * The `uptimeList` map has keys `"<id>_24"` (24 h) and `"<id>_720"` (30 d).
 */
function applyUptimeRatios(monitors: DashboardMonitor[], uptimeList: Record<string, number>): void {
  for (const monitor of monitors) {
    const ratio = uptimeList[`${monitor.id}_24`];
    if (typeof ratio === 'number' && !Number.isNaN(ratio)) {
      monitor.uptimePct = Math.round(ratio * 10000) / 10000; // 4 decimal places → "99.98%"
    }
  }
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
