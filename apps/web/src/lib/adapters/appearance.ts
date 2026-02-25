/**
 * Enumerates supported resolved themes for the dashboard shell.
 */
export type ResolvedTheme = 'light' | 'dark';

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
 * Detects whether the current runtime likely runs on Linux.
 */
function isLinuxRuntime(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return navigator.userAgent.toLowerCase().includes('linux');
}

/**
 * Reads Linux system color preference through XDG desktop portal settings.
 */
async function readLinuxPortalThemePreference(): Promise<ResolvedTheme | null> {
  if (!isTauriRuntime() || !isLinuxRuntime()) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<string | null>('linux_portal_color_scheme');
    if (result === 'dark' || result === 'light') {
      return result;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detects system color scheme with Linux portal priority and media-query fallback.
 */
export async function detectSystemTheme(): Promise<ResolvedTheme> {
  const linuxPortalTheme = await readLinuxPortalThemePreference();
  if (linuxPortalTheme) {
    return linuxPortalTheme;
  }

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
