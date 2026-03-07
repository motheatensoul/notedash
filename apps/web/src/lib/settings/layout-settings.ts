/**
 * Enumerates the available widget size options for the dashboard layout.
 * - `small`: Narrow column, suited for simple list widgets.
 * - `medium`: Standard column width.
 * - `large`: Wide column for content-heavy widgets.
 * - `full`: Full 12-column span across the dashboard grid.
 */
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

/**
 * Describes the layout preferences for a single widget.
 * `kind` corresponds to a DashboardWidget kind value (e.g. 'agenda', 'rss').
 */
export interface WidgetLayoutEntry {
  /** Widget kind identifier used to match against registered widgets. */
  kind: string;
  /** Column span size applied to the widget card. */
  size: WidgetSize;
  /** Display order within the grid (lower = earlier). */
  order: number;
  /** When true, the widget is excluded from the visible dashboard grid. */
  hidden: boolean;
}

/**
 * Persisted layout configuration for the dashboard.
 */
export interface LayoutSettings {
  widgets: WidgetLayoutEntry[];
}

/**
 * Local storage key for dashboard layout settings.
 */
export const LAYOUT_SETTINGS_STORAGE_KEY = 'notedash:layout-settings:v1';

/**
 * Builds a default layout entry for a widget kind.
 *
 * @param kind - Widget kind identifier.
 * @param size - Default column span size.
 * @param order - Initial display order.
 * @returns A layout entry with `hidden: false`.
 */
export function defaultLayoutEntry(kind: string, size: WidgetSize, order: number): WidgetLayoutEntry {
  return { kind, size, order, hidden: false };
}

/**
 * Loads layout settings from localStorage with fallback to provided defaults.
 *
 * @param defaults - Fallback layout settings when storage is absent or corrupt.
 * @returns Parsed and validated layout settings.
 */
export function loadLayoutSettings(defaults: LayoutSettings): LayoutSettings {
  if (typeof window === 'undefined') {
    return defaults;
  }

  const raw = window.localStorage.getItem(LAYOUT_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LayoutSettings>;
    if (!Array.isArray(parsed.widgets)) {
      return defaults;
    }

    return { widgets: parsed.widgets as WidgetLayoutEntry[] };
  } catch {
    return defaults;
  }
}

/**
 * Persists layout settings to localStorage.
 *
 * @param settings - Layout settings to persist.
 */
export function saveLayoutSettings(settings: LayoutSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LAYOUT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Removes layout settings from localStorage.
 */
export function clearLayoutSettings(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(LAYOUT_SETTINGS_STORAGE_KEY);
}

/**
 * Merges persisted layout entries with the canonical widget defaults.
 *
 * Rules:
 * - Saved entries for known kinds override the defaults (preserving size, order, hidden).
 * - Missing kinds from defaults are appended at the end with their default values.
 * - Unknown kinds present in saved entries (no matching default) are dropped.
 *
 * This is the extension point for future widget additions: add to `defaults` and
 * existing saved layouts will incorporate the new entry automatically.
 *
 * @param saved - Persisted layout settings (may be outdated).
 * @param defaults - Canonical list of widget defaults from the registry.
 * @returns Merged, ordered list of layout entries.
 */
export function mergeLayoutWithDefaults(
  saved: LayoutSettings,
  defaults: WidgetLayoutEntry[]
): WidgetLayoutEntry[] {
  const savedByKind = new Map<string, WidgetLayoutEntry>(
    saved.widgets.map((entry) => [entry.kind, entry])
  );

  const knownKinds = new Set(defaults.map((d) => d.kind));
  const merged: WidgetLayoutEntry[] = [];

  for (const def of defaults) {
    const persisted = savedByKind.get(def.kind);
    if (persisted) {
      merged.push(persisted);
    } else {
      merged.push(def);
    }
  }

  // Append any saved entries for kinds not in defaults (should not occur in normal use,
  // but guard against stale keys from removed widgets).
  // Per plan: drop unknown kinds not in defaults — handled by the loop above (only iterates defaults).
  void knownKinds;

  return merged.sort((a, b) => a.order - b.order);
}
