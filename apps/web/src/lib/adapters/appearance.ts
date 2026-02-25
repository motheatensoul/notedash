/**
 * Enumerates supported resolved themes for the dashboard shell.
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Defines a callback used to remove theme listeners.
 */
export type ThemeListenerCleanup = () => void;

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

/**
 * Subscribes to system theme changes from browser and Tauri runtimes.
 */
export async function listenForSystemThemeChanges(
  callback: () => void
): Promise<ThemeListenerCleanup> {
  const cleanup: ThemeListenerCleanup[] = [];

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', callback);
      cleanup.push(() => {
        mediaQueryList.removeEventListener('change', callback);
      });
    } else {
      mediaQueryList.addListener(callback);
      cleanup.push(() => {
        mediaQueryList.removeListener(callback);
      });
    }
  }

  if (isTauriRuntime()) {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen('tauri://theme-changed', () => {
        callback();
      });
      cleanup.push(() => {
        unlisten();
      });
    } catch {
      // Ignore desktop event listener failures and keep browser listeners.
    }
  }

  return () => {
    for (const remove of cleanup) {
      remove();
    }
  };
}
