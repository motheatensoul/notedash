import { describe, expect, test } from 'bun:test';
import {
  appearanceSettingsDefaults,
  sanitizeAppearanceSettings,
  type AppearanceSettings
} from './appearance-settings';

describe('appearanceSettingsDefaults', () => {
  test('returns system theme mode and default color theme', () => {
    const defaults = appearanceSettingsDefaults();
    expect(defaults.themeMode).toBe('system');
    expect(defaults.colorTheme).toBe('default');
    expect(defaults.customThemeCss).toBeUndefined();
  });
});

describe('sanitizeAppearanceSettings', () => {
  const fallback: AppearanceSettings = appearanceSettingsDefaults();

  describe('themeMode', () => {
    test('accepts system', () => {
      const result = sanitizeAppearanceSettings({ ...fallback, themeMode: 'system' });
      expect(result.themeMode).toBe('system');
    });

    test('accepts light', () => {
      const result = sanitizeAppearanceSettings({ ...fallback, themeMode: 'light' });
      expect(result.themeMode).toBe('light');
    });

    test('accepts dark', () => {
      const result = sanitizeAppearanceSettings({ ...fallback, themeMode: 'dark' });
      expect(result.themeMode).toBe('dark');
    });

    test('falls back for unknown mode', () => {
      const result = sanitizeAppearanceSettings({
        ...fallback,
        themeMode: 'neon' as AppearanceSettings['themeMode']
      });
      expect(result.themeMode).toBe(fallback.themeMode);
    });
  });

  describe('colorTheme — accent themes', () => {
    for (const theme of ['default', 'ocean', 'forest', 'sunset', 'custom']) {
      test(`accepts accent theme: ${theme}`, () => {
        const result = sanitizeAppearanceSettings({ ...fallback, colorTheme: theme });
        expect(result.colorTheme).toBe(theme);
      });
    }
  });

  describe('colorTheme — palette registry themes', () => {
    for (const theme of [
      'catppuccin-latte',
      'catppuccin-frappe',
      'catppuccin-macchiato',
      'catppuccin-mocha',
      'dracula',
      'gruvbox-dark',
      'gruvbox-light',
      'nord',
      'one-dark',
      'rose-pine',
      'rose-pine-dawn',
      'solarized-dark',
      'solarized-light',
      'tokyo-night'
    ]) {
      test(`accepts palette theme: ${theme}`, () => {
        const result = sanitizeAppearanceSettings({ ...fallback, colorTheme: theme });
        expect(result.colorTheme).toBe(theme);
      });
    }
  });

  describe('colorTheme — invalid values', () => {
    test('falls back for unknown color theme string', () => {
      const result = sanitizeAppearanceSettings({ ...fallback, colorTheme: 'not-a-theme' });
      expect(result.colorTheme).toBe(fallback.colorTheme);
    });

    test('falls back for empty string', () => {
      const result = sanitizeAppearanceSettings({ ...fallback, colorTheme: '' });
      expect(result.colorTheme).toBe(fallback.colorTheme);
    });
  });

  describe('customThemeCss', () => {
    test('passes through custom CSS when present', () => {
      const css = ':root { --background: oklch(0.1 0 0); }';
      const result = sanitizeAppearanceSettings({ ...fallback, colorTheme: 'custom', customThemeCss: css });
      expect(result.customThemeCss).toBe(css);
    });

    test('passes through undefined customThemeCss', () => {
      const result = sanitizeAppearanceSettings({ ...fallback, customThemeCss: undefined });
      expect(result.customThemeCss).toBeUndefined();
    });
  });
});
