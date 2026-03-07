import { PALETTE_THEMES } from '$lib/themes/registry';

/**
 * Enumerates theme mode options supported by the dashboard shell.
 */
export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Color theme identifier. May be:
 * - A built-in accent theme key: 'default' | 'ocean' | 'forest' | 'sunset'
 * - Any key from the PALETTE_THEMES registry (e.g. 'catppuccin-mocha', 'dracula')
 * - 'custom' for a user-supplied CSS snippet
 */
export type ColorTheme = string;

/**
 * Defines persisted appearance settings for dashboard theming.
 */
export interface AppearanceSettings {
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  /** Raw CSS snippet pasted by the user when colorTheme is 'custom'. */
  customThemeCss?: string;
}

/**
 * Defines the local storage key for appearance settings.
 */
export const APPEARANCE_SETTINGS_STORAGE_KEY = 'notedash:appearance-settings:v1';

/**
 * Provides baseline appearance settings when no preferences are stored.
 */
export function appearanceSettingsDefaults(): AppearanceSettings {
  return {
    themeMode: 'system',
    colorTheme: 'default'
  };
}

/**
 * Loads appearance settings from local storage with default fallback.
 */
export function loadAppearanceSettings(defaults: AppearanceSettings): AppearanceSettings {
  if (typeof window === 'undefined') {
    return defaults;
  }

  const raw = window.localStorage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return sanitizeAppearanceSettings(
      {
        themeMode: parsed.themeMode ?? defaults.themeMode,
        colorTheme: parsed.colorTheme ?? defaults.colorTheme,
        customThemeCss: parsed.customThemeCss
      },
      defaults
    );
  } catch {
    return defaults;
  }
}

/**
 * Persists appearance settings to local storage.
 */
export function saveAppearanceSettings(settings: AppearanceSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(APPEARANCE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Removes persisted appearance settings from local storage.
 */
export function clearAppearanceSettings(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(APPEARANCE_SETTINGS_STORAGE_KEY);
}

/**
 * Sanitizes appearance settings values.
 */
export function sanitizeAppearanceSettings(
  value: AppearanceSettings,
  fallback: AppearanceSettings = appearanceSettingsDefaults()
): AppearanceSettings {
  return {
    themeMode: sanitizeThemeMode(value.themeMode, fallback.themeMode),
    colorTheme: sanitizeColorTheme(value.colorTheme, fallback.colorTheme),
    customThemeCss: value.customThemeCss
  };
}

/**
 * Returns a valid theme mode with fallback for unknown input.
 */
function sanitizeThemeMode(value: string, fallback: ThemeMode): ThemeMode {
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value;
  }

  return fallback;
}

/**
 * Built-in accent-only theme keys that do not require palette registry entries.
 */
const ACCENT_THEMES = new Set(['default', 'ocean', 'forest', 'sunset', 'custom']);

/**
 * Returns a valid color theme key with fallback for unknown input.
 * Accepts built-in accent keys, any PALETTE_THEMES registry key, or 'custom'.
 */
function sanitizeColorTheme(value: string, fallback: ColorTheme): ColorTheme {
  if (ACCENT_THEMES.has(value) || value in PALETTE_THEMES) {
    return value;
  }

  return fallback;
}
