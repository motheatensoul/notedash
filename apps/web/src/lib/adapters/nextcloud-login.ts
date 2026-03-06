/**
 * Defines Nextcloud login flow polling metadata.
 */
export interface NextcloudLoginFlowPollMeta {
  token: string;
  endpoint: string;
}

/**
 * Defines Nextcloud login flow bootstrap response.
 */
export interface NextcloudLoginFlowStart {
  login: string;
  poll: NextcloudLoginFlowPollMeta;
}

/**
 * Defines Nextcloud app credentials returned after successful login flow.
 */
export interface NextcloudLoginCredentials {
  server: string;
  loginName: string;
  appPassword: string;
}

interface NextcloudLoginFlowPollResponse {
  ready: boolean;
  credentials: NextcloudLoginCredentials | null;
}

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
 * Starts Nextcloud login flow v2 through the desktop backend.
 */
export async function startNextcloudLoginFlow(serverUrl: string): Promise<NextcloudLoginFlowStart> {
  if (!isTauriRuntime()) {
    throw new Error('Nextcloud browser login is currently supported in desktop mode only.');
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<NextcloudLoginFlowStart>('nextcloud_login_flow_start', {
    serverUrl
  });
}

/**
 * Opens a URL with the desktop default browser.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    throw new Error('Unable to open browser outside runtime context.');
  }

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_external_url', { url });
}

/**
 * Polls Nextcloud login flow until credentials become available.
 */
export async function waitForNextcloudLoginCredentials(
  poll: NextcloudLoginFlowPollMeta,
  timeoutMs = 120000
): Promise<NextcloudLoginCredentials> {
  if (!isTauriRuntime()) {
    throw new Error('Nextcloud browser login polling is currently supported in desktop mode only.');
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await invoke<NextcloudLoginFlowPollResponse>('nextcloud_login_flow_poll', {
      endpoint: poll.endpoint,
      token: poll.token
    });

    if (response.ready && response.credentials) {
      return response.credentials;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
  }

  throw new Error('Timed out waiting for Nextcloud sign-in.');
}

/**
 * Normalizes server URL from credentials into canonical origin.
 */
export function normalizeServerOrigin(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}
