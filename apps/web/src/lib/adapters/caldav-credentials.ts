/**
 * Defines secure CalDAV credential parameters.
 */
export interface CaldavCredentialInput {
  serverUrl: string;
  username: string;
  appPassword: string;
}

/**
 * Defines secure CalDAV credential lookup parameters.
 */
export interface CaldavCredentialLookup {
  serverUrl: string;
  username: string;
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
 * Returns whether secure desktop credential storage is available.
 */
export function canUseSecureCaldavCredentialStore(): boolean {
  return isTauriRuntime();
}

/**
 * Saves CalDAV credentials to the desktop secure credential store.
 */
export async function saveSecureCaldavCredentials(input: CaldavCredentialInput): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('save_caldav_credentials', {
    serverUrl: input.serverUrl,
    username: input.username,
    appPassword: input.appPassword
  });
}

/**
 * Loads CalDAV credentials from the desktop secure credential store.
 */
export async function loadSecureCaldavPassword(
  lookup: CaldavCredentialLookup
): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string | null>('load_caldav_credentials', {
    serverUrl: lookup.serverUrl,
    username: lookup.username
  });
}

/**
 * Clears CalDAV credentials from the desktop secure credential store.
 */
export async function clearSecureCaldavCredentials(
  lookup: CaldavCredentialLookup
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('clear_caldav_credentials', {
    serverUrl: lookup.serverUrl,
    username: lookup.username
  });
}
