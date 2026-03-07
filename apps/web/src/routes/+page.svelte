<script lang="ts">
  import { onMount } from 'svelte';
  import { Copy, GripVertical, LayoutGrid, PenSquare, Pin, RefreshCw, Settings2, Star } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { env } from '$env/dynamic/public';
  import type { DashboardEvent, DashboardMonitor, DashboardNote, DashboardTodo } from '@notedash/types';
  import type { DashboardWidget } from '$lib/widgets/types';
  import SetupChecklist, { type SetupChecklistItem } from '$lib/components/SetupChecklist.svelte';
  import FeedStatusSettings from '$lib/components/FeedStatusSettings.svelte';
  import AppearanceSettings from '$lib/components/AppearanceSettings.svelte';
  import WidgetRefreshButton from '$lib/components/WidgetRefreshButton.svelte';
  import OnboardingModal from '$lib/components/OnboardingModal.svelte';
  import StatusPill, { type StatusPillTone } from '$lib/components/StatusPill.svelte';
  import SectionHeading from '$lib/components/SectionHeading.svelte';
  import type { OnboardingDraft } from '$lib/onboarding/validation';
  import { buildSetupChecklistItems as buildChecklistItemsModel } from '$lib/onboarding/checklist';
  import {
    buildOnboardingDraftFromSource,
    composeEmailLinksRaw
  } from '$lib/onboarding/profile-mapping';
  import {
    clearOnboardingDismissed,
    markOnboardingDismissed,
    shouldOpenOnboarding
  } from '$lib/onboarding/session-state';
  import WidgetCard from '$lib/components/WidgetCard.svelte';
  import { tryLoadCoreWasm } from '$lib/core/wasm';
  import { deleteCache, readCacheEntry, writeCache } from '$lib/cache/ttl-cache';
  import {
    appearanceSettingsDefaults,
    clearAppearanceSettings,
    loadAppearanceSettings,
    sanitizeAppearanceSettings,
    saveAppearanceSettings,
    type AppearanceSettings as AppearanceSettingsModel
  } from '$lib/settings/appearance-settings';
  import { PALETTE_THEMES } from '$lib/themes/registry';
  import {
    clearLayoutSettings,
    defaultLayoutEntry,
    loadLayoutSettings,
    mergeLayoutWithDefaults,
    saveLayoutSettings,
    type LayoutSettings,
    type WidgetLayoutEntry,
    type WidgetSize
  } from '$lib/settings/layout-settings';
  import { detectSystemTheme, listenForSystemThemeChanges } from '$lib/adapters/appearance';
  import {
    normalizeServerOrigin,
    openExternalUrl,
    startNextcloudLoginFlow,
    waitForNextcloudLoginCredentials
  } from '$lib/adapters/nextcloud-login';
  import {
    canUseSecureCaldavCredentialStore,
    clearSecureCaldavCredentials,
    loadSecureCaldavPassword,
    saveSecureCaldavCredentials
  } from '$lib/adapters/caldav-credentials';
  import {
    clearRuntimeSettings,
    loadRuntimeSettings,
    runtimeSettingsFromPublicEnv,
    sanitizeRuntimeSettings,
    saveRuntimeSettings,
    type RuntimeSettings
  } from '$lib/settings/runtime-settings';
  import {
    clearUserProfileSettings,
    loadUserProfileSettings,
    saveUserProfileSettings,
    sanitizeUserProfileSettings,
    userProfileDefaultsFromPublicEnv,
    type UserProfileSettings
  } from '$lib/settings/user-profile-settings';
  import { fetchCaldavAgendaDetailed, createCaldavTodo, type CaldavWriteConfig } from '$lib/adapters/caldav';
  import { fetchRecentNotesDetailed, fetchVaultTasks, type ObsidianTask } from '$lib/adapters/obsidian';
  import { parseEmailProviders, resolveEmailLinks } from '$lib/adapters/email';
  import { diffTasks } from '$lib/sync/task-sync';
  import TaskSyncDialog from '$lib/components/TaskSyncDialog.svelte';
  import { ArrowLeftRight } from '@lucide/svelte';
  import { fetchRssItemsDetailed } from '$lib/adapters/rss';
  import { fetchUptimeKumaStatusDetailed } from '$lib/adapters/uptime-kuma';
  import { buildInitialWidgets } from '$lib/widgets/registry';

  /**
   * Holds the initial widget registry output.
   */
  let widgets: DashboardWidget[] = buildInitialWidgets();

  /**
   * Represents the runtime load state for a widget.
   */
  type WidgetRuntimeState = 'loading' | 'ok' | 'stale' | 'error';

  /**
   * Tracks widget runtime state for card header indicators.
   */
  let widgetState: Record<DashboardWidget['kind'], WidgetRuntimeState> =
    buildInitialWidgetStateMap();

  /**
   * Tracks optional widget subtitle metadata.
   */
  let widgetSubtitle: Partial<Record<DashboardWidget['kind'], string>> = {};

  /**
   * Tracks optional diagnostic error details per widget.
   */
  let widgetErrorDetail: Partial<Record<DashboardWidget['kind'], string>> = {};

  /**
   * Tracks task sync dialog state and in-progress status.
   */
  let taskSyncOpen = false;
  let taskSyncInProgress = false;
  let taskSyncConflicts: ObsidianTask[] = [];

  const RSS_CACHE_KEY = 'notedash:widget:rss';
  const STATUS_CACHE_KEY = 'notedash:widget:status';
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  let freshnessIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Tracks timestamp metadata used for dynamic freshness subtitles.
   */
  let widgetFreshness: Partial<
    Record<
      Extract<DashboardWidget['kind'], 'rss' | 'status'>,
      { mode: 'cached' | 'updated'; atEpochMs: number }
    >
  > = {};

  /**
   * Tracks manual refresh activity per widget.
   */
  let manualRefreshState: Partial<Record<Extract<DashboardWidget['kind'], 'rss' | 'status'>, boolean>> =
    {};

  /**
   * Tracks whether profile-driven widgets are being manually refreshed.
   */
  let profileRefreshInProgress = false;
  let checklistChecksInProgress = false;
  let checklistLastRunAtEpochMs: number | null = null;
  let checklistLastWarningCount: number | null = null;
  let checklistMetaTickEpochMs = Date.now();
  let copiedNotePath: string | null = null;
  let noteCopyFeedback = '';
  let noteCopyResetTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Defines copy-link status messages used by notes widget feedback UI.
   */
  const NOTE_COPY_MESSAGES = {
    clipboardUnavailable: 'Clipboard is unavailable in this runtime.',
    copied: 'Copied Obsidian link.',
    copiedPath: 'Copied note path.',
    copyFailed: 'Failed to copy link. Check browser clipboard permissions.'
  } as const;

  /**
   * Holds persisted feed/status override settings.
   */
  const runtimeSettingsDefaults = runtimeSettingsFromPublicEnv(env);
  let runtimeSettings: RuntimeSettings = loadRuntimeSettings(runtimeSettingsDefaults);
  const userProfileDefaults = userProfileDefaultsFromPublicEnv(env);
  let userProfile: UserProfileSettings = loadUserProfileSettings(userProfileDefaults);
  const appearanceDefaults = appearanceSettingsDefaults();
  let appearanceSettings: AppearanceSettingsModel = loadAppearanceSettings(appearanceDefaults);
  let appearanceDraft: AppearanceSettingsModel = { ...appearanceSettings };
  let appearanceStatusMessage = '';

  /**
   * Builds the canonical default layout entries from the widget registry order.
   */
  function buildDefaultLayoutEntries(): WidgetLayoutEntry[] {
    return [
      // Row 1: agenda (9) + status (3) = 12
      defaultLayoutEntry('agenda', 'large', 0),
      defaultLayoutEntry('status', 'small', 1),
      // Row 2: todos (6) + notes (6) = 12
      defaultLayoutEntry('todos', 'medium', 2),
      defaultLayoutEntry('notes', 'medium', 3),
      // Row 3: rss (9) + email-links (3) = 12
      defaultLayoutEntry('rss', 'large', 4),
      defaultLayoutEntry('email-links', 'small', 5)
    ];
  }

  const layoutDefaults: LayoutSettings = { widgets: buildDefaultLayoutEntries() };
  let layoutSettings: LayoutSettings = {
    widgets: mergeLayoutWithDefaults(loadLayoutSettings(layoutDefaults), buildDefaultLayoutEntries())
  };

  /**
   * Tracks whether the dashboard is in interactive layout-edit mode.
   */
  let layoutEditMode = false;

  /**
   * Holds the kind of the widget currently being dragged, or null.
   */
  let dragSourceKind: string | null = null;
  let removeSystemThemeListener: (() => void) | null = null;

  /**
   * Holds editable settings panel draft values.
   */
  let settingsDraft: RuntimeSettings = { ...runtimeSettings };

  /**
   * Holds short status text for settings save actions.
   */
  let settingsStatusMessage = '';
  let onboardingStatusMessage = '';
  let onboardingStatusTone: 'neutral' | 'error' = 'neutral';
  let onboardingNextcloudLoginInProgress = false;

  interface NextcloudConnectionState {
    serverUrl: string;
    username: string;
    appPassword: string;
    connected: boolean;
  }

  let onboardingNextcloudConnection: NextcloudConnectionState = {
    serverUrl: '',
    username: '',
    appPassword: '',
    connected: false
  };

  let settingsOpen = false;
  let onboardingOpen = shouldOpenOnboarding(
    userProfile.onboardingCompleted,
    typeof window === 'undefined' ? undefined : window.sessionStorage
  );
  let onboardingDraft: OnboardingDraft = buildOnboardingDraft();

  syncOnboardingNextcloudConnectionFromProfile();

  $: setupChecklistItems = buildSetupChecklistItems();

  /**
   * Stores the loaded WASM module for reuse.
   */
  let wasmModule: Awaited<ReturnType<typeof tryLoadCoreWasm>> = null;

  onMount(() => {
    void applyAppearanceSettings(appearanceSettings);
    void setupSystemThemeListener();
    void bootDashboard();

    return () => {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
      }

      if (freshnessIntervalId) {
        clearInterval(freshnessIntervalId);
      }

      if (noteCopyResetTimer) {
        clearTimeout(noteCopyResetTimer);
      }

      if (removeSystemThemeListener) {
        removeSystemThemeListener();
      }
    };
  });

  /**
   * Bootstraps dashboard widget loading and background refresh.
   */
  async function bootDashboard(): Promise<void> {
    wasmModule = await tryLoadCoreWasm();
    const rssCacheTtlSeconds = runtimeSettings.rssCacheTtlSeconds;
    const statusCacheTtlSeconds = runtimeSettings.statusCacheTtlSeconds;

    const agendaWidget = widgets.find((widget) => widget.kind === 'agenda');
    if (wasmModule && agendaWidget && agendaWidget.data.length > 0) {
      replaceWidgetData('agenda', safeNormalizeEvents(wasmModule.normalize_events, agendaWidget.data));
    }

    const cachedRss = readCacheEntry<Extract<DashboardWidget, { kind: 'rss' }>['data']>(RSS_CACHE_KEY);
    if (cachedRss && cachedRss.data.length > 0) {
      replaceWidgetData('rss', cachedRss.data.slice(0, 12));
      setWidgetState('rss', 'stale');
      setWidgetFreshness('rss', 'cached', cachedRss.cachedAtEpochMs);
    }

    const cachedStatus = readCacheEntry<Extract<DashboardWidget, { kind: 'status' }>['data']>(
      STATUS_CACHE_KEY
    );
    if (cachedStatus && cachedStatus.data.length > 0) {
      replaceWidgetData('status', cachedStatus.data);
      setWidgetState('status', 'stale');
      setWidgetFreshness('status', 'cached', cachedStatus.cachedAtEpochMs);
    }

    await refreshProfileDrivenWidgets();

    await refreshRssAndStatus(
      rssCacheTtlSeconds,
      statusCacheTtlSeconds,
      cachedRss != null,
      cachedStatus != null
    );

    restartFeedStatusRefreshLoop();

    restartMetadataRefreshLoop();
  }

  /**
   * Refreshes RSS and service status widgets and updates local cache.
   */
  async function refreshRssAndStatus(
    rssCacheTtlSeconds: number,
    statusCacheTtlSeconds: number,
    hadCachedRss: boolean,
    hadCachedStatus: boolean
  ): Promise<void> {
    if (!hadCachedRss) {
      setWidgetState('rss', 'loading');
    }

    if (!hadCachedStatus) {
      setWidgetState('status', 'loading');
    }

    const rssConfigured = runtimeSettings.rssFeedUrls.trim().length > 0;
    const statusConfigured = runtimeSettings.uptimeKumaStatusUrl.trim().length > 0;

    const [rssResult, statusResult] = await Promise.all([
      fetchRssItemsDetailed({
        feedUrls: runtimeSettings.rssFeedUrls
          .split(',')
          .map((value: string) => value.trim())
          .filter(Boolean)
      }),
      fetchUptimeKumaStatusDetailed({ statusPageUrl: runtimeSettings.uptimeKumaStatusUrl })
    ]);

    const rssItems = rssResult.items;
    const monitors = statusResult.monitors;

    if (rssItems.length > 0) {
      const sliced = rssItems.slice(0, 12);
      replaceWidgetData('rss', sliced);
      writeCache(RSS_CACHE_KEY, sliced, rssCacheTtlSeconds);
      setWidgetState('rss', 'ok');
      setWidgetError('rss');
      setWidgetFreshness('rss', 'updated', Date.now());
    } else if (hadCachedRss) {
      setWidgetState('rss', 'stale');
      setWidgetError('rss', rssResult.errorDetail);
    } else if (rssConfigured) {
      setWidgetState('rss', 'error');
      setWidgetError('rss', rssResult.errorDetail ?? 'Could not fetch any configured RSS feeds');
    } else {
      setWidgetState('rss', 'ok');
      setWidgetError('rss');
    }

    if (monitors.length > 0) {
      const normalized = wasmModule
        ? safeNormalizeMonitors(wasmModule.normalize_monitors, monitors)
        : monitors;
      replaceWidgetData('status', normalized);
      writeCache(STATUS_CACHE_KEY, normalized, statusCacheTtlSeconds);
      setWidgetState('status', 'ok');
      setWidgetError('status');
      setWidgetFreshness('status', 'updated', Date.now());
    } else if (hadCachedStatus) {
      setWidgetState('status', 'stale');
      setWidgetError('status', statusResult.errorDetail);
    } else if (statusConfigured) {
      setWidgetState('status', 'error');
      setWidgetError('status', statusResult.errorDetail ?? 'Could not load Uptime Kuma status data');
    } else {
      setWidgetState('status', 'ok');
      setWidgetError('status');
    }
  }

  /**
   * Loads profile-driven integrations and applies widget data/state updates.
   */
  async function refreshProfileDrivenWidgets(): Promise<void> {
    const caldavPassword = await resolveCaldavAppPassword({
      calendarUrl: userProfile.caldavCalendarUrl,
      todoUrl: userProfile.caldavTodoUrl,
      username: userProfile.caldavUsername,
      appPassword:
        userProfile.caldavAppPassword ||
        (userProfile.caldavProvider === 'nextcloud' &&
        onboardingNextcloudConnection.connected &&
        onboardingNextcloudConnection.username === userProfile.caldavUsername
          ? onboardingNextcloudConnection.appPassword
          : '')
    });

    const [caldavResult, notesResult, emailLinks] = await Promise.all([
      fetchCaldavAgendaDetailed({
        serverUrl: userProfile.caldavCalendarUrl,
        todoUrl: userProfile.caldavTodoUrl,
        username: userProfile.caldavUsername,
        appPassword: caldavPassword,
        lookaheadDays: 45
      }),
      fetchRecentNotesDetailed({
        vaultPath: userProfile.obsidianVaultPath,
        limit: 12
      }),
      resolveEmailLinks({
        providers: parseEmailProviders(userProfile.emailLinksRaw)
      })
    ]);

    if (caldavResult.events.length > 0) {
      const normalized = wasmModule
        ? safeNormalizeEvents(wasmModule.normalize_events, caldavResult.events)
        : caldavResult.events;
      replaceWidgetData('agenda', normalized.slice(0, 12));
    }
    applyCaldavWidgetState('agenda', userProfile.caldavCalendarUrl.length > 0, caldavResult.errorDetail);
    setWidgetSubtitle('agenda', 'Read-only CalDAV');

    if (caldavResult.todos.length > 0) {
      replaceWidgetData('todos', caldavResult.todos.slice(0, 12));
    }
    applyCaldavWidgetState(
      'todos',
      (userProfile.caldavTodoUrl || userProfile.caldavCalendarUrl).length > 0,
      caldavResult.errorDetail
    );
    setWidgetSubtitle('todos', 'Read-only CalDAV');

    if (notesResult.notes.length > 0) {
      replaceWidgetData('notes', notesResult.notes);
    }
    applyNotesWidgetState(
      userProfile.obsidianVaultPath.length > 0,
      notesResult.errorDetail,
      notesResult.warningDetail
    );
    setWidgetSubtitle(
      'notes',
      notesResult.notes.length > 0
        ? `Updated ${formatRelativeIso(notesResult.notes[0].updatedAtIso)}`
        : (notesResult.warningDetail ?? '')
    );

    if (emailLinks.length > 0) {
      replaceWidgetData('email-links', emailLinks);
    }
    setWidgetState('email-links', 'ok');
    setWidgetError('email-links');
    setWidgetSubtitle('email-links', `${emailLinks.length} inbox links`);
  }

  /**
   * Triggers an immediate manual refresh for RSS and status widgets.
   */
  async function refreshFeedStatusNow(): Promise<void> {
    const rssCacheTtlSeconds = runtimeSettings.rssCacheTtlSeconds;
    const statusCacheTtlSeconds = runtimeSettings.statusCacheTtlSeconds;

    manualRefreshState = {
      rss: true,
      status: true
    };

    try {
      await refreshRssAndStatus(rssCacheTtlSeconds, statusCacheTtlSeconds, true, true);
    } finally {
      manualRefreshState = {
        rss: false,
        status: false
      };
    }
  }

  /**
   * Triggers an immediate manual refresh for profile-driven widgets.
   */
  async function refreshProfileWidgetsNow(): Promise<void> {
    profileRefreshInProgress = true;

    setWidgetState('agenda', 'loading');
    setWidgetState('todos', 'loading');
    setWidgetState('notes', 'loading');

    try {
      await refreshProfileDrivenWidgets();
    } finally {
      profileRefreshInProgress = false;
    }
  }

  /**
   * Returns whether the app is running inside a Tauri WebView.
   */
  function isTauri(): boolean {
    if (typeof window === 'undefined') return false;
    return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
  }

  /**
   * Builds a CalDAV write config from the current user profile.
   * Resolves the app password through the full credential chain (in-memory → keyring).
   */
  async function buildCaldavWriteConfig(): Promise<CaldavWriteConfig> {
    const appPassword = await resolveCaldavAppPassword({
      calendarUrl: userProfile.caldavCalendarUrl,
      todoUrl: userProfile.caldavTodoUrl,
      username: userProfile.caldavUsername,
      appPassword: userProfile.caldavAppPassword
    });
    return {
      serverUrl: userProfile.caldavTodoUrl || userProfile.caldavCalendarUrl,
      username: userProfile.caldavUsername,
      appPassword
    };
  }

  /**
   * Syncs Obsidian vault tasks against CalDAV todos.
   * CalDAV is source of truth — Obsidian tasks are updated to match.
   * Tasks only in Obsidian are surfaced in the conflict dialog.
   */
  async function syncTasksNow(): Promise<void> {
    if (taskSyncInProgress) return;
    taskSyncInProgress = true;

    try {
      const caldavTodos = widgets.find((w) => w.kind === 'todos')?.data ?? [];
      const obsidianTasks = await fetchVaultTasks(userProfile.obsidianVaultPath);
      const { toUpdateInObsidian, onlyInObsidian } = diffTasks(
        caldavTodos as import('@notedash/types').DashboardTodo[],
        obsidianTasks
      );

      if (toUpdateInObsidian.length > 0) {
        const { invoke } = await import('@tauri-apps/api/core');
        for (const { task, newDone } of toUpdateInObsidian) {
          await invoke('update_vault_task', {
            vaultPath: userProfile.obsidianVaultPath,
            filePath: task.filePath,
            lineNumber: task.lineNumber,
            done: newDone
          }).catch((error: unknown) => {
            console.warn('[sync] Failed to update vault task:', error);
          });
        }
      }

      if (onlyInObsidian.length > 0) {
        taskSyncConflicts = onlyInObsidian;
        taskSyncOpen = true;
      }
    } finally {
      taskSyncInProgress = false;
    }
  }

  /**
   * Applies conflict resolution decisions — adds kept tasks to CalDAV.
   */
  async function resolveTaskConflicts(decisions: Map<string, 'keep' | 'discard'>): Promise<void> {
    const config = await buildCaldavWriteConfig();
    for (const [key, decision] of decisions) {
      if (decision === 'keep') {
        const task = taskSyncConflicts.find(
          (t) => `${t.filePath}:${t.lineNumber}` === key
        );
        if (task) {
          await createCaldavTodo(config, task.title).catch((error: unknown) => {
            console.warn('[sync] Failed to create CalDAV todo:', error);
          });
        }
      }
    }
    taskSyncOpen = false;
    taskSyncConflicts = [];
    await refreshProfileWidgetsNow();
  }

  /**
   * Runs all integration refresh checks used by the setup checklist.
   */
  async function runChecklistHealthChecksNow(): Promise<void> {
    checklistChecksInProgress = true;
    try {
      await Promise.all([refreshProfileWidgetsNow(), refreshFeedStatusNow()]);
      checklistLastRunAtEpochMs = Date.now();
      checklistLastWarningCount = setupChecklistItems.filter((item) => item.state === 'warn').length;
    } finally {
      checklistChecksInProgress = false;
    }
  }

  /**
   * Returns checklist verification metadata label.
   */
  function checklistMetaLabel(): string {
    void checklistMetaTickEpochMs;

    if (checklistChecksInProgress) {
      return 'Running integration checks...';
    }

    if (checklistLastRunAtEpochMs == null) {
      return '';
    }

    const warningText =
      checklistLastWarningCount == null || checklistLastWarningCount === 0
        ? 'no warnings'
        : `${checklistLastWarningCount} warning${checklistLastWarningCount === 1 ? '' : 's'}`;

    return `Last check run ${formatRelativeTime(checklistLastRunAtEpochMs)} (${warningText})`;
  }

  /**
   * Applies in-app settings overrides and restarts feed/status refresh.
   */
  async function applyRuntimeSettings(nextDraft: RuntimeSettings = settingsDraft): Promise<void> {
    runtimeSettings = sanitizeRuntimeSettings(nextDraft, runtimeSettingsDefaults);
    settingsDraft = { ...runtimeSettings };
    saveRuntimeSettings(runtimeSettings);

    deleteCache(RSS_CACHE_KEY);
    deleteCache(STATUS_CACHE_KEY);
    setWidgetState('rss', 'loading');
    setWidgetState('status', 'loading');
    setWidgetError('rss');
    setWidgetError('status');

    settingsStatusMessage = 'Settings saved. Refreshing feed and status widgets...';

    await refreshRssAndStatus(
      runtimeSettings.rssCacheTtlSeconds,
      runtimeSettings.statusCacheTtlSeconds,
      false,
      false
    );
    restartFeedStatusRefreshLoop();
    settingsStatusMessage = 'Settings applied.';
  }

  /**
   * Applies appearance settings and persists the sanitized draft.
   */
  async function applyAppearanceSettings(
    nextDraft: AppearanceSettingsModel = appearanceDraft
  ): Promise<void> {
    appearanceSettings = sanitizeAppearanceSettings(nextDraft, appearanceDefaults);
    appearanceDraft = { ...appearanceSettings };
    saveAppearanceSettings(appearanceSettings);

    await syncDocumentAppearance();
    appearanceStatusMessage = 'Appearance settings applied.';
  }

  /**
   * Resets the editable appearance draft to active values.
   */
  function resetAppearanceDraft(): void {
    appearanceDraft = { ...appearanceSettings };
    appearanceStatusMessage = 'Appearance draft reset to active settings.';
  }

  /**
   * Injects a style tag (id: nd-palette-theme) for the active palette theme,
   * or removes it if the theme is not a registry palette.
   *
   * @param colorTheme - The current color theme key.
   */
  /**
   * Tracks which CSS custom properties were applied by the last palette theme
   * so they can be cleaned up when switching themes.
   */
  let appliedPaletteVars: string[] = [];

  function applyPaletteTheme(colorTheme: string): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Remove previously applied inline palette vars.
    for (const key of appliedPaletteVars) {
      root.style.removeProperty(key);
    }
    appliedPaletteVars = [];

    const palette = PALETTE_THEMES[colorTheme];
    if (!palette) return;

    // Set vars as inline styles (specificity [1,0,0,0]) so they beat
    // the :root.dark selector used in app.css (specificity [0,2,0]).
    for (const [k, v] of Object.entries(palette.vars)) {
      if (v) {
        root.style.setProperty(`--${k}`, v);
        appliedPaletteVars.push(`--${k}`);
      }
    }
  }

  /**
   * Sanitizes a raw CSS string before injecting it into the DOM.
   * Strips patterns that could enable XSS or data exfiltration.
   *
   * @param raw - Raw CSS text to sanitize.
   * @returns Sanitized CSS string.
   */
  function sanitizeCustomCss(raw: string): string {
    return raw
      .replace(/url\s*\(/gi, 'url-blocked(')
      .replace(/@import\b/gi, '/* @import blocked */')
      .replace(/javascript\s*:/gi, 'blocked:')
      .replace(/expression\s*\(/gi, 'blocked(');
  }

  /**
   * Injects or removes a style tag (id: nd-custom-theme) for user-pasted CSS.
   *
   * @param colorTheme - The current color theme key.
   * @param customCss - The raw custom CSS string from settings.
   */
  function applyCustomTheme(colorTheme: string, customCss: string | undefined): void {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById('nd-custom-theme');
    if (existing) existing.remove();

    if (colorTheme !== 'custom' || !customCss?.trim()) return;

    const style = document.createElement('style');
    style.id = 'nd-custom-theme';
    style.textContent = sanitizeCustomCss(customCss);
    document.head.appendChild(style);
  }

  /**
   * Applies the active appearance settings to the root document.
   */
  async function syncDocumentAppearance(): Promise<void> {
    if (typeof document === 'undefined') {
      return;
    }

    const resolvedTheme =
      appearanceSettings.themeMode === 'system' ? await detectSystemTheme() : appearanceSettings.themeMode;
    const root = document.documentElement;
    const body = document.body;
    const isDark = resolvedTheme === 'dark';

    // Palette themes override the dark/light class — apply their mode instead.
    const palette = PALETTE_THEMES[appearanceSettings.colorTheme];
    const effectiveIsDark = palette ? palette.mode !== 'light' : isDark;

    root.classList.toggle('dark', effectiveIsDark);
    body?.classList.toggle('dark', effectiveIsDark);
    root.setAttribute('data-color-theme', appearanceSettings.colorTheme);
    body?.setAttribute('data-color-theme', appearanceSettings.colorTheme);
    root.style.colorScheme = palette ? (palette.mode === 'light' ? 'light' : 'dark') : resolvedTheme;
    if (body) {
      body.style.colorScheme = palette ? (palette.mode === 'light' ? 'light' : 'dark') : resolvedTheme;
    }

    applyPaletteTheme(appearanceSettings.colorTheme);
    applyCustomTheme(appearanceSettings.colorTheme, appearanceSettings.customThemeCss);
  }

  /**
   * Subscribes to OS theme changes when system mode is active.
   */
  async function setupSystemThemeListener(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    if (removeSystemThemeListener) {
      removeSystemThemeListener();
    }

    removeSystemThemeListener = await listenForSystemThemeChanges(() => {
      if (appearanceSettings.themeMode !== 'system') {
        return;
      }

      void syncDocumentAppearance();
    });

    const remove = removeSystemThemeListener;
    removeSystemThemeListener = () => {
      if (!remove) {
        removeSystemThemeListener = null;
        return;
      }

      remove();
      removeSystemThemeListener = null;
    };
  }

  /**
   * Resolves CalDAV password from secure store when available.
   */
  async function resolveCaldavAppPassword(input: {
    calendarUrl: string;
    todoUrl: string;
    username: string;
    appPassword: string;
  }): Promise<string> {
    const localPassword = input.appPassword.trim();
    if (localPassword) {
      return localPassword;
    }

    if (!canUseSecureCaldavCredentialStore()) {
      return '';
    }

    const username = input.username.trim();
    const serverUrl = input.calendarUrl.trim() || input.todoUrl.trim();
    if (!username || !serverUrl) {
      return '';
    }

    const securePassword = await loadSecureCaldavPassword({
      serverUrl,
      username
    });

    return securePassword?.trim() ?? '';
  }

  /**
   * Builds an onboarding draft from current profile and runtime settings.
   */
  function buildOnboardingDraft(): OnboardingDraft {
    return buildOnboardingDraftFromSource({
      emailLinksRaw: userProfile.emailLinksRaw,
      rssFeedUrls: runtimeSettings.rssFeedUrls,
      uptimeKumaStatusUrl: runtimeSettings.uptimeKumaStatusUrl,
      caldavProvider: userProfile.caldavProvider,
      caldavCalendarUrl: userProfile.caldavCalendarUrl,
      caldavTodoUrl: userProfile.caldavTodoUrl,
      caldavUsername: userProfile.caldavUsername,
      caldavAppPassword: userProfile.caldavAppPassword,
      obsidianVaultPath: userProfile.obsidianVaultPath
    });
  }

  /**
   * Syncs Nextcloud onboarding connection state from persisted profile values.
   */
  function syncOnboardingNextcloudConnectionFromProfile(): void {
    const serverUrl = (userProfile.caldavCalendarUrl || userProfile.caldavTodoUrl).trim();
    const username = userProfile.caldavUsername.trim();

    onboardingNextcloudConnection = {
      serverUrl,
      username,
      appPassword: '',
      connected:
        userProfile.caldavProvider === 'nextcloud' && serverUrl.length > 0 && username.length > 0
    };
  }

  /**
   * Validates CalDAV onboarding configuration against the live endpoint.
   */
  async function validateOnboardingCaldavConfiguration(draft: OnboardingDraft): Promise<string | null> {
    const isNextcloudProvider = draft.caldavProvider === 'nextcloud';
    const calendarUrl = isNextcloudProvider
      ? onboardingNextcloudConnection.serverUrl.trim()
      : draft.caldavCalendarUrl.trim();
    const todoUrl = isNextcloudProvider ? onboardingNextcloudConnection.serverUrl.trim() : draft.caldavTodoUrl.trim();
    const username = isNextcloudProvider ? onboardingNextcloudConnection.username.trim() : draft.caldavUsername.trim();
    const appPassword = isNextcloudProvider ? '' : draft.caldavAppPassword;

    if (isNextcloudProvider && !onboardingNextcloudConnection.connected) {
      return 'Complete Nextcloud sign-in before saving onboarding.';
    }

    if (!calendarUrl && !todoUrl) {
      return null;
    }

    onboardingStatusMessage = 'Validating CalDAV access...';

    const resolvedPassword = await resolveCaldavAppPassword({
      calendarUrl,
      todoUrl,
      username,
      appPassword: appPassword || onboardingNextcloudConnection.appPassword
    });

    if (isNextcloudProvider && !resolvedPassword) {
      return 'Could not read Nextcloud app password from secure storage. Please sign in again.';
    }

    const result = await fetchCaldavAgendaDetailed({
      serverUrl: calendarUrl,
      todoUrl,
      username,
      appPassword: resolvedPassword,
      lookaheadDays: 21
    });

    if (!result.errorDetail) {
      return null;
    }

    const detail = result.errorDetail;
    if (detail.includes('HTTP 401') || detail.includes('HTTP 403')) {
      return 'CalDAV authentication failed. For Nextcloud, use your account username and an app password.';
    }

    return `CalDAV setup check failed: ${detail}`;
  }

  /**
   * Starts Nextcloud login flow v2 and applies returned credentials to onboarding draft.
   */
  async function startOnboardingNextcloudLoginFlow(): Promise<void> {
    if (onboardingNextcloudLoginInProgress) {
      return;
    }

    let candidateUrl =
      onboardingNextcloudConnection.serverUrl.trim() ||
      onboardingDraft.caldavCalendarUrl.trim() ||
      onboardingDraft.caldavTodoUrl.trim();

    if (!candidateUrl) {
      if (typeof window !== 'undefined') {
        const prompted = window.prompt('Enter your Nextcloud server URL (for example: https://cloud.example.com)');
        candidateUrl = prompted?.trim() ?? '';
      }

      if (!candidateUrl) {
        onboardingStatusTone = 'error';
        onboardingStatusMessage = 'Nextcloud server URL is required to start browser sign-in.';
        return;
      }
    }

    onboardingNextcloudLoginInProgress = true;
    onboardingStatusTone = 'neutral';
    onboardingStatusMessage = 'Starting Nextcloud sign-in flow...';

    try {
      const flowStart = await startNextcloudLoginFlow(candidateUrl);
      await openExternalUrl(flowStart.login);

      onboardingStatusMessage = 'Finish sign-in in your browser. Waiting for confirmation...';
      const credentials = await waitForNextcloudLoginCredentials(flowStart.poll);

      const serverOrigin = normalizeServerOrigin(credentials.server);
      const remoteDavUrl = `${serverOrigin}/remote.php/dav`;

      await saveSecureCaldavCredentials({
        serverUrl: remoteDavUrl,
        username: credentials.loginName,
        appPassword: credentials.appPassword
      });

      onboardingNextcloudConnection = {
        serverUrl: remoteDavUrl,
        username: credentials.loginName,
        appPassword: credentials.appPassword,
        connected: true
      };

      onboardingStatusTone = 'neutral';
      onboardingStatusMessage = 'Nextcloud sign-in complete. Connection is ready.';
    } catch (error) {
      onboardingStatusTone = 'error';
      onboardingStatusMessage =
        error instanceof Error ? error.message : 'Nextcloud sign-in failed. Please verify server URL and try again.';
    } finally {
      onboardingNextcloudLoginInProgress = false;
    }
  }

  /**
   * Completes onboarding and applies settings/profile values immediately.
   */
  async function completeOnboarding(draft: OnboardingDraft): Promise<void> {
    onboardingStatusTone = 'neutral';
    onboardingStatusMessage = 'Applying onboarding settings...';

    const caldavValidationError = await validateOnboardingCaldavConfiguration(draft);
    if (caldavValidationError) {
      onboardingStatusMessage = caldavValidationError;
      onboardingStatusTone = 'error';
      return;
    }

    const isNextcloudProvider = draft.caldavProvider === 'nextcloud';
    const profileCaldavCalendarUrl = isNextcloudProvider
      ? onboardingNextcloudConnection.serverUrl
      : draft.caldavCalendarUrl;
    const profileCaldavTodoUrl = isNextcloudProvider
      ? onboardingNextcloudConnection.serverUrl
      : draft.caldavTodoUrl;
    const profileCaldavUsername = isNextcloudProvider
      ? onboardingNextcloudConnection.username
      : draft.caldavUsername;

    const trimmedCaldavPassword = draft.caldavAppPassword.trim();
    const trimmedCaldavUsername = profileCaldavUsername.trim();
    const trimmedCalendarUrl = profileCaldavCalendarUrl.trim();
    const trimmedTodoUrl = profileCaldavTodoUrl.trim();

    if (!isNextcloudProvider && trimmedCaldavPassword && trimmedCaldavUsername && canUseSecureCaldavCredentialStore()) {
      const secureServerUrl = trimmedCalendarUrl || trimmedTodoUrl;
      if (secureServerUrl) {
        await saveSecureCaldavCredentials({
          serverUrl: secureServerUrl,
          username: trimmedCaldavUsername,
          appPassword: trimmedCaldavPassword
        });
      }
    }

    const profilePasswordToPersist =
      canUseSecureCaldavCredentialStore() || isNextcloudProvider ? '' : draft.caldavAppPassword;

    const sanitizedProfile = sanitizeUserProfileSettings(
      {
        onboardingCompleted: true,
        emailLinksRaw: composeEmailLinksRaw(draft),
        caldavProvider: draft.caldavProvider,
        caldavCalendarUrl: profileCaldavCalendarUrl,
        caldavTodoUrl: profileCaldavTodoUrl,
        caldavUsername: profileCaldavUsername,
        caldavAppPassword: profilePasswordToPersist,
        obsidianVaultPath: draft.obsidianVaultPath
      },
      userProfileDefaults
    );

    userProfile = sanitizedProfile;
    saveUserProfileSettings(userProfile);

    runtimeSettings = sanitizeRuntimeSettings(
      {
        ...runtimeSettings,
        rssFeedUrls: draft.rssFeedUrls,
        uptimeKumaStatusUrl: draft.uptimeKumaStatusUrl
      },
      runtimeSettingsDefaults
    );
    settingsDraft = { ...runtimeSettings };
    saveRuntimeSettings(runtimeSettings);

    await refreshProfileDrivenWidgets();

    deleteCache(RSS_CACHE_KEY);
    deleteCache(STATUS_CACHE_KEY);
    await refreshRssAndStatus(
      runtimeSettings.rssCacheTtlSeconds,
      runtimeSettings.statusCacheTtlSeconds,
      false,
      false
    );
    restartFeedStatusRefreshLoop();
    restartMetadataRefreshLoop();

    onboardingOpen = false;
    if (typeof window !== 'undefined') {
      clearOnboardingDismissed(window.sessionStorage);
    }
    onboardingStatusMessage = 'Onboarding complete.';
    onboardingStatusTone = 'neutral';
    settingsStatusMessage = 'Applied onboarding settings.';
    onboardingDraft = buildOnboardingDraft();
    onboardingNextcloudConnection = {
      ...onboardingNextcloudConnection,
      appPassword: ''
    };
    syncOnboardingNextcloudConnectionFromProfile();
  }

  /**
   * Dismisses onboarding for the current session without persisting completion.
   */
  function dismissOnboarding(): void {
    onboardingOpen = false;
    if (typeof window !== 'undefined') {
      markOnboardingDismissed(window.sessionStorage);
    }
    onboardingStatusMessage = 'Onboarding skipped for now. You can reopen it anytime.';
    onboardingStatusTone = 'neutral';
    onboardingNextcloudLoginInProgress = false;
    onboardingNextcloudConnection = {
      ...onboardingNextcloudConnection,
      appPassword: ''
    };
    syncOnboardingNextcloudConnectionFromProfile();
  }

  /**
   * Reopens onboarding to edit provider and URL setup.
   */
  function openOnboarding(): void {
    onboardingDraft = buildOnboardingDraft();
    syncOnboardingNextcloudConnectionFromProfile();
    onboardingStatusMessage = '';
    onboardingStatusTone = 'neutral';
    onboardingNextcloudLoginInProgress = false;
    onboardingNextcloudConnection = {
      ...onboardingNextcloudConnection,
      appPassword: ''
    };
    if (typeof window !== 'undefined') {
      clearOnboardingDismissed(window.sessionStorage);
    }
    onboardingOpen = true;
  }

  /**
   * Builds checklist rows that summarize key onboarding setup completion.
   */
  function buildSetupChecklistItems(): SetupChecklistItem[] {
    return buildChecklistItemsModel({
      emailLinkCount: parseEmailProviders(userProfile.emailLinksRaw).length,
      emailLinksRaw: userProfile.emailLinksRaw,
      rssFeedUrls: runtimeSettings.rssFeedUrls,
      uptimeKumaStatusUrl: runtimeSettings.uptimeKumaStatusUrl,
      caldavCalendarUrl: userProfile.caldavCalendarUrl,
      obsidianVaultPath: userProfile.obsidianVaultPath,
      noteCount: widgets.find((widget) => widget.kind === 'notes')?.data.length ?? 0,
      widgetState: {
        rss: widgetState.rss,
        status: widgetState.status,
        agenda: widgetState.agenda,
        todos: widgetState.todos,
        notes: widgetState.notes
      },
      widgetErrorDetail: {
        rss: widgetErrorDetail.rss,
        status: widgetErrorDetail.status,
        agenda: widgetErrorDetail.agenda,
        todos: widgetErrorDetail.todos,
        notes: widgetErrorDetail.notes
      }
    });
  }

  /**
   * Restarts the polling loop for RSS and service status widgets.
   */
  function restartFeedStatusRefreshLoop(): void {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
    }

    refreshIntervalId = setInterval(() => {
      void refreshRssAndStatus(
        runtimeSettings.rssCacheTtlSeconds,
        runtimeSettings.statusCacheTtlSeconds,
        widgetState.rss === 'stale' || widgetState.rss === 'ok',
        widgetState.status === 'stale' || widgetState.status === 'ok'
      );
    }, runtimeSettings.refreshSeconds * 1000);
  }

  /**
   * Restarts the metadata timer used by relative freshness labels.
   */
  function restartMetadataRefreshLoop(): void {
    if (freshnessIntervalId) {
      clearInterval(freshnessIntervalId);
    }

    freshnessIntervalId = setInterval(() => {
      refreshFreshnessSubtitles();
      checklistMetaTickEpochMs = Date.now();
    }, 15000);
  }

  /**
   * Resets the editable settings draft to the currently active values.
   */
  function resetSettingsDraft(): void {
    settingsDraft = { ...runtimeSettings };
    settingsStatusMessage = 'Draft reset to active settings.';
  }

  /**
   * Clears persisted setup/profile data and restarts onboarding flow.
   */
  function resetAllSetup(): void {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Reset all dashboard setup data and reopen onboarding? This clears local profile, runtime, and appearance settings.'
      );
      if (!confirmed) {
        return;
      }
    }

    clearRuntimeSettings();
    clearUserProfileSettings();
    clearAppearanceSettings();
    clearLayoutSettings();
    void clearSecureCaldavCredentials({
      serverUrl: userProfile.caldavCalendarUrl || userProfile.caldavTodoUrl,
      username: userProfile.caldavUsername
    });

    resetDashboardForOnboarding();

    runtimeSettings = { ...runtimeSettingsDefaults };
    settingsDraft = { ...runtimeSettings };
    saveRuntimeSettings(runtimeSettings);

    userProfile = { ...userProfileDefaults, onboardingCompleted: false };
    saveUserProfileSettings(userProfile);
    syncOnboardingNextcloudConnectionFromProfile();

    appearanceSettings = { ...appearanceDefaults };
    appearanceDraft = { ...appearanceSettings };
    saveAppearanceSettings(appearanceSettings);
    void syncDocumentAppearance();
    appearanceStatusMessage = 'Appearance reset to defaults (system + default color).';

    layoutSettings = { widgets: buildDefaultLayoutEntries() };
    layoutEditMode = false;

    deleteCache(RSS_CACHE_KEY);
    deleteCache(STATUS_CACHE_KEY);

    onboardingDraft = buildOnboardingDraft();
    onboardingStatusMessage = '';
    onboardingStatusTone = 'neutral';
    onboardingNextcloudLoginInProgress = false;
    if (typeof window !== 'undefined') {
      clearOnboardingDismissed(window.sessionStorage);
    }

    onboardingNextcloudConnection = {
      serverUrl: '',
      username: '',
      appPassword: '',
      connected: false
    };
    onboardingOpen = true;
    settingsStatusMessage = 'Setup reset. Complete onboarding to continue.';
  }

  /**
   * Resets dashboard widget data and runtime state prior to re-onboarding.
   */
  function resetDashboardForOnboarding(): void {
    widgets = buildInitialWidgets();
    widgetState = buildInitialWidgetStateMap();
    widgetSubtitle = {};
    widgetErrorDetail = {};
    widgetFreshness = {};
    manualRefreshState = {};

    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }

    if (freshnessIntervalId) {
      clearInterval(freshnessIntervalId);
      freshnessIntervalId = null;
    }
  }

  /**
   * Stores freshness metadata for a widget and updates the subtitle label.
   */
  function setWidgetFreshness(
    kind: Extract<DashboardWidget['kind'], 'rss' | 'status'>,
    mode: 'cached' | 'updated',
    atEpochMs: number
  ): void {
    widgetFreshness = {
      ...widgetFreshness,
      [kind]: {
        mode,
        atEpochMs
      }
    };

    refreshFreshnessSubtitles();
  }

  /**
   * Recomputes relative freshness subtitles from stored timestamps.
   */
  function refreshFreshnessSubtitles(): void {
    const rssFreshness = widgetFreshness.rss;
    if (rssFreshness) {
      setWidgetSubtitle(
        'rss',
        `${rssFreshness.mode === 'cached' ? 'Cached' : 'Updated'} ${formatRelativeTime(rssFreshness.atEpochMs)}`
      );
    }

    const statusFreshness = widgetFreshness.status;
    if (statusFreshness) {
      setWidgetSubtitle(
        'status',
        `${statusFreshness.mode === 'cached' ? 'Cached' : 'Updated'} ${formatRelativeTime(statusFreshness.atEpochMs)}`
      );
    }
  }

  /**
   * Updates one widget runtime state value immutably.
   */
  function setWidgetState(kind: DashboardWidget['kind'], state: WidgetRuntimeState): void {
    widgetState = {
      ...widgetState,
      [kind]: state
    };
  }

  /**
   * Updates one widget subtitle value immutably.
   */
  function setWidgetSubtitle(kind: DashboardWidget['kind'], subtitle: string): void {
    widgetSubtitle = {
      ...widgetSubtitle,
      [kind]: subtitle
    };
  }

  /**
   * Updates one widget diagnostic error detail immutably.
   */
  function setWidgetError(kind: DashboardWidget['kind'], detail?: string): void {
    if (!detail) {
      const { [kind]: _removed, ...rest } = widgetErrorDetail;
      widgetErrorDetail = rest;
      return;
    }

    widgetErrorDetail = {
      ...widgetErrorDetail,
      [kind]: detail
    };
  }

  /**
   * Applies CalDAV widget state/error based on configuration and diagnostics.
   */
  function applyCaldavWidgetState(
    kind: Extract<DashboardWidget['kind'], 'agenda' | 'todos'>,
    configured: boolean,
    errorDetail?: string
  ): void {
    if (!configured) {
      setWidgetState(kind, 'ok');
      setWidgetError(kind);
      return;
    }

    if (errorDetail) {
      setWidgetState(kind, 'error');
      setWidgetError(kind, errorDetail);
      return;
    }

    setWidgetState(kind, 'ok');
    setWidgetError(kind);
  }

  /**
   * Applies notes widget state/error based on vault configuration and diagnostics.
   */
  function applyNotesWidgetState(
    configured: boolean,
    errorDetail?: string,
    warningDetail?: string
  ): void {
    if (!configured) {
      setWidgetState('notes', 'ok');
      setWidgetError('notes');
      return;
    }

    if (errorDetail) {
      setWidgetState('notes', 'error');
      setWidgetError('notes', errorDetail);
      return;
    }

    if (warningDetail) {
      setWidgetState('notes', 'ok');
      setWidgetError('notes');
      return;
    }

    setWidgetState('notes', 'ok');
    setWidgetError('notes');
  }

  /**
   * Formats epoch timestamps as short relative labels.
   */
  function formatRelativeTime(epochMs: number): string {
    const seconds = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
    if (seconds < 60) {
      return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /**
   * Formats ISO timestamps as relative labels.
   */
  function formatRelativeIso(iso: string): string {
    const epoch = new Date(iso).getTime();
    if (Number.isNaN(epoch)) {
      return 'unknown';
    }

    return formatRelativeTime(epoch);
  }

  /**
   * Formats an event start time with date-aware contextual labels.
   */
  function formatEventDate(startsAtIso: string): string {
    const date = new Date(startsAtIso);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) {
      return `Today ${timeLabel}`;
    }

    if (diffDays === 1) {
      return `Tomorrow ${timeLabel}`;
    }

    if (diffDays > 1 && diffDays <= 6) {
      return `${date.toLocaleDateString([], { weekday: 'short' })} ${timeLabel}`;
    }

    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeLabel}`;
  }

  /**
   * Calls the Rust monitor normalization function with fail-safe fallback.
   */
  function safeNormalizeMonitors(
    normalize: (raw: DashboardMonitor[]) => DashboardMonitor[],
    monitors: DashboardMonitor[]
  ): DashboardMonitor[] {
    try {
      return normalize(monitors);
    } catch {
      return monitors;
    }
  }

  /**
   * Calls the Rust agenda normalization function with fail-safe fallback.
   */
  function safeNormalizeEvents(
    normalize: (raw: DashboardEvent[]) => DashboardEvent[],
    events: DashboardEvent[]
  ): DashboardEvent[] {
    try {
      return normalize(events);
    } catch {
      return events;
    }
  }

  /**
   * Replaces one widget's data while preserving its card metadata.
   */
  function replaceWidgetData<K extends DashboardWidget['kind']>(
    kind: K,
    data: Extract<DashboardWidget, { kind: K }>['data']
  ): void {
    widgets = widgets.map((widget) => {
      if (widget.kind !== kind) {
        return widget;
      }

      return {
        ...widget,
        data
      } as DashboardWidget;
    });
  }

  /**
   * Creates a status color for monitor badges.
   */
  function monitorClass(state: DashboardMonitor['state']): StatusPillTone {
    if (state === 'up') {
      return 'ok';
    }
    if (state === 'degraded') {
      return 'warn';
    }
    return 'down';
  }

  /**
   * Builds the initial widget state map used for first render and resets.
   */
  function buildInitialWidgetStateMap(): Record<DashboardWidget['kind'], WidgetRuntimeState> {
    return {
      agenda: 'loading',
      todos: 'loading',
      notes: 'loading',
      rss: 'loading',
      status: 'loading',
      'email-links': 'loading'
    };
  }

  /**
   * Selects the checkbox symbol for task rows.
   */
  function todoSymbol(todo: DashboardTodo): string {
    return todo.done ? 'x' : ' ';
  }

  /**
   * Creates an accessibility label for optional note preference flags.
   */
  function noteMetaA11yLabel(note: DashboardNote): string {
    if (note.isPinned && note.isFavorite) {
      return 'Pinned and favorite note';
    }

    if (note.isPinned) {
      return 'Pinned note';
    }

    if (note.isFavorite) {
      return 'Favorite note';
    }

    return '';
  }

  /**
   * Builds an `obsidian://` URI for opening a note by absolute path.
   */
  function buildObsidianNoteHref(vaultPath: string, relativePath: string): string {
    const normalizedVaultPath = vaultPath.trim().replace(/[\\/]+$/, '');
    const normalizedRelativePath = relativePath.trim().replace(/^[\\/]+/, '').replace(/\\/g, '/');
    const absolutePath = `${normalizedVaultPath}/${normalizedRelativePath}`;

    return `obsidian://open?path=${encodeURIComponent(absolutePath)}`;
  }

  /**
   * Opens a note deep-link using the host runtime when available.
   */
  function openObsidianNote(vaultPath: string, relativePath: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.open(buildObsidianNoteHref(vaultPath, relativePath), '_blank', 'noopener,noreferrer');
  }

  /**
   * Copies a note deep-link to the clipboard and shows a short confirmation state.
   */
  async function copyObsidianNoteHref(vaultPath: string, relativePath: string): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      copiedNotePath = null;
      noteCopyFeedback = NOTE_COPY_MESSAGES.clipboardUnavailable;
      scheduleNoteCopyReset();
      return;
    }

    const href = buildObsidianNoteHref(vaultPath, relativePath);
    await copyNoteText(href, NOTE_COPY_MESSAGES.copied, relativePath);
  }

  /**
   * Copies a note's relative path and shows a short confirmation state.
   */
  async function copyNotePath(relativePath: string): Promise<void> {
    await copyNoteText(relativePath, NOTE_COPY_MESSAGES.copiedPath, relativePath);
  }

  /**
   * Copies text to clipboard and updates shared note copy feedback UI state.
   */
  async function copyNoteText(
    value: string,
    successMessage: string,
    copiedPathValue: string | null
  ): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      copiedNotePath = null;
      noteCopyFeedback = NOTE_COPY_MESSAGES.clipboardUnavailable;
      scheduleNoteCopyReset();
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      copiedNotePath = copiedPathValue;
      noteCopyFeedback = successMessage;
      scheduleNoteCopyReset();
    } catch {
      copiedNotePath = null;
      noteCopyFeedback = NOTE_COPY_MESSAGES.copyFailed;
      scheduleNoteCopyReset();
    }
  }

  /**
   * Clears temporary note copy UI state after a short delay.
   */
  function scheduleNoteCopyReset(): void {
    if (noteCopyResetTimer) {
      clearTimeout(noteCopyResetTimer);
    }

    noteCopyResetTimer = setTimeout(() => {
      copiedNotePath = null;
      noteCopyFeedback = '';
      noteCopyResetTimer = null;
    }, 1700);
  }

  /**
   * Cycles through widget sizes in a fixed order.
   *
   * @param current - The current WidgetSize value.
   * @returns The next size in the cycle.
   */
  function cycleWidgetSize(current: WidgetSize): WidgetSize {
    const cycle: WidgetSize[] = ['small', 'medium', 'large', 'full'];
    const idx = cycle.indexOf(current);
    return cycle[(idx + 1) % cycle.length];
  }

  /**
   * Updates the size of a layout entry and persists immediately.
   *
   * @param kind - Widget kind to resize.
   */
  function resizeWidget(kind: string): void {
    layoutSettings = {
      widgets: layoutSettings.widgets.map((entry) =>
        entry.kind === kind ? { ...entry, size: cycleWidgetSize(entry.size) } : entry
      )
    };
    saveLayoutSettings(layoutSettings);
  }

  /**
   * Hides a widget from the dashboard and persists immediately.
   *
   * @param kind - Widget kind to hide.
   */
  function hideWidget(kind: string): void {
    layoutSettings = {
      widgets: layoutSettings.widgets.map((entry) =>
        entry.kind === kind ? { ...entry, hidden: true } : entry
      )
    };
    saveLayoutSettings(layoutSettings);
  }

  /**
   * Restores a previously hidden widget and persists immediately.
   *
   * @param kind - Widget kind to restore.
   */
  function restoreWidget(kind: string): void {
    layoutSettings = {
      widgets: layoutSettings.widgets.map((entry) =>
        entry.kind === kind ? { ...entry, hidden: false } : entry
      )
    };
    saveLayoutSettings(layoutSettings);
  }

  /**
   * Swaps the order values of two widgets and persists immediately.
   *
   * @param sourceKind - Widget being dragged.
   * @param targetKind - Widget being dropped onto.
   */
  function swapWidgetOrder(sourceKind: string, targetKind: string): void {
    if (sourceKind === targetKind) return;

    const sourceEntry = layoutSettings.widgets.find((e) => e.kind === sourceKind);
    const targetEntry = layoutSettings.widgets.find((e) => e.kind === targetKind);
    if (!sourceEntry || !targetEntry) return;

    const sourceOrder = sourceEntry.order;
    const targetOrder = targetEntry.order;

    layoutSettings = {
      widgets: layoutSettings.widgets.map((entry) => {
        if (entry.kind === sourceKind) return { ...entry, order: targetOrder };
        if (entry.kind === targetKind) return { ...entry, order: sourceOrder };
        return entry;
      })
    };
    saveLayoutSettings(layoutSettings);
  }

  /**
   * Resolves the display title for a widget kind.
   *
   * @param kind - Widget kind identifier.
   * @returns The widget title string.
   */
  function widgetTitleForKind(kind: string): string {
    return widgets.find((w) => w.kind === kind)?.title ?? kind;
  }

  /**
   * Starts a drag operation for a widget and records the source kind.
   *
   * @param e - The DragEvent from the dragstart handler.
   * @param kind - The widget kind being dragged.
   */
  function handleWidgetDragStart(e: DragEvent, kind: string): void {
    dragSourceKind = kind;
    e.dataTransfer?.setData('text/plain', kind);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  /**
   * Allows a dragged widget to be dropped by preventing the default action.
   *
   * @param e - The DragEvent from the dragover handler.
   */
  function handleWidgetDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  }

  /**
   * Clears the drag-over visual indicator when the drag leaves a widget.
   *
   * @param e - The DragEvent from the dragleave handler.
   */
  function handleWidgetDragLeave(e: DragEvent): void {
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
  }

  /**
   * Clears drag state when the drag operation ends without a drop.
   *
   * @param e - The DragEvent from the dragend handler.
   */
  function handleWidgetDragEnd(e: DragEvent): void {
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    dragSourceKind = null;
  }

  /**
   * Handles a widget drop by swapping order values of source and target.
   *
   * @param e - The DragEvent from the drop handler.
   * @param targetKind - The widget kind being dropped onto.
   */
  function handleWidgetDrop(e: DragEvent, targetKind: string): void {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    if (dragSourceKind && dragSourceKind !== targetKind) {
      swapWidgetOrder(dragSourceKind, targetKind);
    }
    dragSourceKind = null;
  }

  /**
   * Handles note-row keyboard shortcuts for open/copy actions.
   */
  function handleNoteRowKeydown(event: KeyboardEvent, notePath: string): void {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const hasVaultPath = userProfile.obsidianVaultPath.trim().length > 0;
    if (event.key === 'o' || event.key === 'O') {
      if (hasVaultPath) {
        event.preventDefault();
        openObsidianNote(userProfile.obsidianVaultPath, notePath);
      }
      return;
    }

    if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      if (hasVaultPath) {
        void copyObsidianNoteHref(userProfile.obsidianVaultPath, notePath);
      } else {
        void copyNotePath(notePath);
      }
    }
  }
</script>

<OnboardingModal
  open={onboardingOpen}
  draft={onboardingDraft}
  statusMessage={onboardingStatusMessage}
  statusTone={onboardingStatusTone}
  nextcloudLoginInProgress={onboardingNextcloudLoginInProgress}
  nextcloudConnected={onboardingNextcloudConnection.connected}
  nextcloudConnectedIdentity={onboardingNextcloudConnection.username}
  on:save={(event) => void completeOnboarding(event.detail.draft)}
  on:dismiss={dismissOnboarding}
  on:startNextcloudLogin={() => void startOnboardingNextcloudLoginFlow()}
/>

<TaskSyncDialog
  open={taskSyncOpen}
  conflicts={taskSyncConflicts}
  resolutionInProgress={taskSyncInProgress}
  on:resolve={(event) => void resolveTaskConflicts(event.detail.decisions)}
  on:dismiss={() => { taskSyncOpen = false; taskSyncConflicts = []; }}
/>

<div class="app-shell">
  <nav class="sidebar" aria-label="Dashboard navigation">
    <a class="sidebar-brand" href="/" aria-label="notedash home">
      <span class="sidebar-logo">nd</span>
      <span class="sidebar-brand-name">notedash</span>
    </a>

    <div class="sidebar-nav">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="sidebar-btn{layoutEditMode ? ' sidebar-btn--active' : ''}"
        onclick={() => (layoutEditMode = !layoutEditMode)}
      >
        <LayoutGrid size={15} aria-hidden="true" />
        <span>{layoutEditMode ? 'Done' : 'Edit layout'}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="sidebar-btn"
        onclick={() => (settingsOpen = true)}
      >
        <Settings2 size={15} aria-hidden="true" />
        <span>Settings</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="sidebar-btn"
        onclick={openOnboarding}
      >
        <PenSquare size={15} aria-hidden="true" />
        <span>Setup</span>
      </Button>
    </div>

    <div class="sidebar-footer">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="sidebar-btn"
        onclick={() => void refreshProfileWidgetsNow()}
        disabled={profileRefreshInProgress}
      >
        <span class:spin={profileRefreshInProgress}>
          <RefreshCw size={15} aria-hidden="true" />
        </span>
        <span>{profileRefreshInProgress ? 'Refreshing…' : 'Refresh'}</span>
      </Button>
    </div>
  </nav>

<main>
  <Dialog.Root bind:open={settingsOpen}>
    <Dialog.Content class="settings-modal sm:max-w-6xl">
      <Dialog.Header>
        <Dialog.Title>Settings</Dialog.Title>
        <Dialog.Description>
          Manage setup completeness, appearance, and feed/status refresh behavior.
        </Dialog.Description>
      </Dialog.Header>

      <section class="control-zone" aria-labelledby="config-heading">
        <SectionHeading headingId="config-heading" title="Configuration" />

        <div class="control-grid">
          <SetupChecklist
            items={setupChecklistItems}
            checksInProgress={checklistChecksInProgress}
            checksMeta={checklistMetaLabel()}
            on:openOnboarding={openOnboarding}
            on:runChecks={() => void runChecklistHealthChecksNow()}
          />

          <FeedStatusSettings
            draft={settingsDraft}
            statusMessage={settingsStatusMessage}
            on:save={(event) => void applyRuntimeSettings(event.detail.draft)}
            on:reset={resetSettingsDraft}
            on:resetSetup={resetAllSetup}
          />

          <AppearanceSettings
            draft={appearanceDraft}
            statusMessage={appearanceStatusMessage}
            on:save={() => void applyAppearanceSettings()}
            on:reset={resetAppearanceDraft}
          />
        </div>
      </section>
    </Dialog.Content>
  </Dialog.Root>

  <section class="widget-zone" aria-labelledby="widgets-heading">
    <section class="grid">
      {#each layoutSettings.widgets.filter((e) => !e.hidden).sort((a, b) => a.order - b.order) as layoutEntry (layoutEntry.kind)}
        {@const widget = widgets.find((w) => w.kind === layoutEntry.kind)}
        {#if widget}
          <div
            class="widget-wrap"
            class:editing={layoutEditMode}
            data-size={layoutEntry.size}
            draggable={layoutEditMode ? 'true' : 'false'}
            role={layoutEditMode ? 'listitem' : undefined}
            ondragstart={(e) => handleWidgetDragStart(e, layoutEntry.kind)}
            ondragover={handleWidgetDragOver}
            ondragleave={handleWidgetDragLeave}
            ondragend={handleWidgetDragEnd}
            ondrop={(e) => handleWidgetDrop(e, layoutEntry.kind)}
          >
            {#if layoutEditMode}
              <div class="widget-controls" role="toolbar" aria-label="Widget controls for {widget.title}">
                <span class="drag-handle" title="Drag to reorder">
                  <GripVertical size={13} aria-hidden="true" />
                </span>
                <button
                  type="button"
                  class="widget-ctrl-btn"
                  title="Cycle size (current: {layoutEntry.size})"
                  onclick={() => resizeWidget(layoutEntry.kind)}
                >
                  {layoutEntry.size}
                </button>
                <button
                  type="button"
                  class="widget-ctrl-btn widget-ctrl-btn--hide"
                  title="Hide widget"
                  onclick={() => hideWidget(layoutEntry.kind)}
                >
                  Hide
                </button>
              </div>
            {/if}
            <WidgetCard
              title={widget.title}
              size={layoutEntry.size}
              status={widgetState[widget.kind]}
              subtitle={widgetSubtitle[widget.kind]}
              statusDetail={widgetErrorDetail[widget.kind]}
            >
        {#if widget.kind === 'agenda'}
          <WidgetRefreshButton
            onRefresh={() => void refreshProfileWidgetsNow()}
            disabled={profileRefreshInProgress}
          />
          {#if widget.data.length === 0}
            {#if widgetState.agenda === 'error'}
              <p class="empty">Agenda refresh failed. Verify CalDAV configuration.</p>
              {#if widgetErrorDetail.agenda}
                <p class="empty-detail">{widgetErrorDetail.agenda}</p>
              {/if}
            {:else}
              <p class="empty">No upcoming events loaded.</p>
            {/if}
          {:else}
            {#each widget.data as item}
              <div class="row">
                <strong>{item.title}</strong>
                <span>{formatEventDate(item.startsAtIso)}</span>
              </div>
            {/each}
          {/if}
        {:else if widget.kind === 'todos'}
          <WidgetRefreshButton
            onRefresh={() => void refreshProfileWidgetsNow()}
            disabled={profileRefreshInProgress}
          />
          {#if isTauri() && userProfile.obsidianVaultPath && userProfile.caldavCalendarUrl}
            <Button
              size="sm"
              variant="ghost"
              onclick={() => void syncTasksNow()}
              disabled={taskSyncInProgress}
            >
              <ArrowLeftRight size={13} aria-hidden="true" />
              {taskSyncInProgress ? 'Syncing…' : 'Sync tasks'}
            </Button>
          {/if}
          {#if widget.data.length === 0}
            {#if widgetState.todos === 'error'}
              <p class="empty">Task refresh failed. Verify CalDAV configuration.</p>
              {#if widgetErrorDetail.todos}
                <p class="empty-detail">{widgetErrorDetail.todos}</p>
              {/if}
            {:else}
              <p class="empty">No open tasks loaded.</p>
            {/if}
          {:else}
            {#each widget.data as item}
              <div class="row font-mono">
                <span>[{todoSymbol(item)}]</span>
                <span>{item.title}</span>
              </div>
            {/each}
          {/if}
        {:else if widget.kind === 'notes'}
          <WidgetRefreshButton
            onRefresh={() => void refreshProfileWidgetsNow()}
            disabled={profileRefreshInProgress}
          />
          {#if noteCopyFeedback}
            <p class="note-copy-feedback" role="status" aria-live="polite">{noteCopyFeedback}</p>
          {/if}
          {#if widget.data.length === 0}
            {#if widgetState.notes === 'error'}
              <p class="empty">Notes refresh failed. Verify desktop vault path and runtime.</p>
              {#if widgetErrorDetail.notes}
                <p class="empty-detail">{widgetErrorDetail.notes}</p>
              {/if}
            {:else}
              <p class="empty">No notes found for the current vault path.</p>
            {/if}
          {:else}
            {#each widget.data as item}
              {@const metaLabel = noteMetaA11yLabel(item)}
              {@const hasVaultPath = userProfile.obsidianVaultPath.trim().length > 0}
              <div
                class="row row--note"
                role="button"
                tabindex="0"
                aria-label={`Note shortcuts: press C to copy${hasVaultPath ? ' or O to open' : ''}`}
                onkeydown={(event) => handleNoteRowKeydown(event, item.path)}
              >
                <div class="row-note-main">
                  <strong>
                    {item.title}
                    {#if metaLabel}
                      <span class="note-meta" aria-label={metaLabel}>
                        {#if item.isPinned}
                          <span class="note-flag note-flag--pinned" title="Pinned note">
                            <Pin size={12} aria-hidden="true" />
                          </span>
                        {/if}
                        {#if item.isFavorite}
                          <span class="note-flag note-flag--favorite" title="Favorite note">
                            <Star size={12} aria-hidden="true" />
                          </span>
                        {/if}
                      </span>
                    {/if}
                  </strong>
                  <span class="note-path">{item.path}</span>
                  <span class="note-time">{formatRelativeIso(item.updatedAtIso)}</span>
                </div>
                {#if hasVaultPath}
                  <div class="note-actions">
                    <a
                      class="note-open"
                      href={buildObsidianNoteHref(userProfile.obsidianVaultPath, item.path)}
                      target="_blank"
                      rel="noreferrer"
                      title="Open note in Obsidian (O)"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      class="note-copy"
                      class:note-copy--copied={copiedNotePath === item.path}
                      title="Copy Obsidian link (C)"
                      onclick={() => void copyObsidianNoteHref(userProfile.obsidianVaultPath, item.path)}
                    >
                      <Copy size={12} aria-hidden="true" />
                      {copiedNotePath === item.path ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                {:else}
                  <div class="note-actions">
                    <button
                      type="button"
                      class="note-copy"
                      class:note-copy--copied={copiedNotePath === item.path}
                      title="Copy note path (C)"
                      onclick={() => void copyNotePath(item.path)}
                    >
                      <Copy size={12} aria-hidden="true" />
                      {copiedNotePath === item.path ? 'Copied' : 'Copy path'}
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        {:else if widget.kind === 'rss'}
          <WidgetRefreshButton
            onRefresh={() => void refreshFeedStatusNow()}
            disabled={manualRefreshState.rss || manualRefreshState.status}
          />
          {#if widget.data.length === 0}
            {#if widgetState.rss === 'loading'}
              <p class="empty">Loading feed items...</p>
            {:else if widgetState.rss === 'error'}
              <p class="empty">Feed refresh failed. Verify RSS URLs and CORS.</p>
              {#if widgetErrorDetail.rss}
                <p class="empty-detail">{widgetErrorDetail.rss}</p>
              {/if}
            {:else}
              <p class="empty">No feed items available.</p>
            {/if}
          {:else}
            {#each widget.data as item}
              <a class="row link" href={item.link} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong>
                <span>{item.source} · {formatRelativeIso(item.publishedAtIso)}</span>
              </a>
            {/each}
          {/if}
        {:else if widget.kind === 'status'}
          <WidgetRefreshButton
            onRefresh={() => void refreshFeedStatusNow()}
            disabled={manualRefreshState.rss || manualRefreshState.status}
          />
          {#if widget.data.length === 0}
            {#if widgetState.status === 'loading'}
              <p class="empty">Loading service status...</p>
            {:else if widgetState.status === 'error'}
              <p class="empty">Status refresh failed. Verify the Uptime Kuma URL.</p>
              {#if widgetErrorDetail.status}
                <p class="empty-detail">{widgetErrorDetail.status}</p>
              {/if}
            {:else}
              <p class="empty">No service status data available.</p>
            {/if}
          {:else}
            {#each widget.data as item}
              <div class="row">
                <strong>{item.name}</strong>
                <div class="status-right">
                  {#if item.uptimePct !== undefined}
                    <span class="latency">{(item.uptimePct * 100).toFixed(2)}%</span>
                  {:else if item.latencyMs !== undefined && item.state === 'up'}
                    <span class="latency">{item.latencyMs}ms</span>
                  {/if}
                  <StatusPill tone={monitorClass(item.state)}>{item.state}</StatusPill>
                </div>
              </div>
            {/each}
          {/if}
        {:else if widget.kind === 'email-links'}
          {#if widget.data.length === 0}
            <p class="empty">No inbox links configured.</p>
          {:else}
            {#each widget.data as item}
              <a class="row link" href={item.href} target="_blank" rel="noreferrer">
                <strong>{item.label}</strong>
                <span>Open inbox</span>
              </a>
            {/each}
          {/if}
        {/if}
            </WidgetCard>
          </div>
        {/if}
      {/each}

      {#if layoutEditMode}
        {@const hiddenEntries = layoutSettings.widgets.filter((e) => e.hidden)}
        {#if hiddenEntries.length > 0}
          <div class="hidden-restore">
            <span class="hidden-restore-label">Hidden widgets</span>
            {#each hiddenEntries as entry (entry.kind)}
              <button
                type="button"
                class="hidden-restore-btn"
                onclick={() => restoreWidget(entry.kind)}
              >
                {widgetTitleForKind(entry.kind)} — Restore
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </section>
  </section>
</main>
</div>

<style>
  /* ── Layout shell ────────────────────────────────────────── */

  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  /* ── Sidebar ──────────────────────────────────────────────── */

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 210px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    padding: 1.2rem 0.75rem;
    gap: 0.25rem;
    background: oklch(var(--sidebar));
    border-right: 1px solid oklch(var(--sidebar-border));
    overflow-y: auto;
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
    padding: 0.45rem 0.6rem;
    margin-bottom: 0.6rem;
    border-radius: var(--radius);
    transition: background-color 120ms ease;
  }

  .sidebar-brand:hover {
    background: oklch(var(--sidebar-accent));
  }

  .sidebar-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.8rem;
    height: 1.8rem;
    border-radius: calc(var(--radius) - 2px);
    background: oklch(var(--sidebar-primary));
    color: oklch(var(--sidebar-primary-foreground));
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .sidebar-brand-name {
    font-weight: 700;
    font-size: 0.92rem;
    letter-spacing: 0.03em;
    color: oklch(var(--sidebar-foreground));
    opacity: 0.85;
  }

  .sidebar-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding-top: 0.5rem;
    border-top: 1px solid oklch(var(--sidebar-border));
    margin-top: 0.5rem;
  }

  :global(.sidebar-btn) {
    width: 100% !important;
    justify-content: flex-start !important;
    gap: 0.55rem !important;
    padding: 0.5rem 0.65rem !important;
    border-radius: var(--radius) !important;
    font-size: 0.875rem !important;
    color: oklch(var(--sidebar-foreground)) !important;
    opacity: 0.75;
    transition: opacity 120ms ease, background-color 120ms ease !important;
  }

  :global(.sidebar-btn:hover) {
    opacity: 1;
    background-color: oklch(var(--sidebar-accent)) !important;
  }

  :global(.sidebar-btn--active) {
    opacity: 1 !important;
    background-color: oklch(var(--sidebar-primary) / 15%) !important;
    color: oklch(var(--sidebar-primary)) !important;
  }

  /* ── Main content area ────────────────────────────────────── */

  main {
    flex: 1;
    margin-left: 210px;
    padding: 1.5rem 1.5rem 3rem;
    min-width: 0;
    display: grid;
    gap: 1rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-auto-rows: minmax(300px, auto);
    gap: 1rem;
    align-items: stretch;
  }

  .control-zone {
    display: grid;
    gap: 0.75rem;
  }

  :global(.settings-modal) {
    width: min(1120px, calc(100vw - 1.4rem));
    max-height: 88vh;
    overflow-y: auto;
  }

  .control-grid {
    display: grid;
    gap: 1rem;
  }

  .widget-zone {
    display: grid;
    gap: 0.75rem;
  }

  /*
   * widget-wrap uses display:contents in normal mode so the WidgetCard's own
   * grid-column span propagates directly to the grid. In edit mode it becomes
   * a real block so the outline, controls, and drag affordances render correctly.
   * The grid span is replicated via data-size attribute selectors.
   */
  .widget-wrap {
    position: relative;
    display: contents;
  }

  .widget-wrap.editing {
    display: block;
    outline: 2px dashed oklch(var(--border));
    outline-offset: 3px;
    border-radius: calc(var(--radius) + 0.35rem);
    cursor: grab;
    padding: 2rem 0 0;
  }

  /* Mirror WidgetCard size spans on the wrapper for edit-mode grid placement */
  :global(.widget-wrap[data-size='small'].editing) { grid-column: span 3; }
  :global(.widget-wrap[data-size='medium'].editing) { grid-column: span 6; }
  :global(.widget-wrap[data-size='large'].editing) { grid-column: span 9; }
  :global(.widget-wrap[data-size='full'].editing) { grid-column: span 12; }

  @media (max-width: 1100px) {
    :global(.widget-wrap[data-size='small'].editing),
    :global(.widget-wrap[data-size='medium'].editing) {
      grid-column: span 6;
    }
    :global(.widget-wrap[data-size='large'].editing),
    :global(.widget-wrap[data-size='full'].editing) {
      grid-column: span 12;
    }
  }

  @media (max-width: 640px) {
    :global(.widget-wrap[data-size='small'].editing),
    :global(.widget-wrap[data-size='medium'].editing),
    :global(.widget-wrap[data-size='large'].editing),
    :global(.widget-wrap[data-size='full'].editing) {
      grid-column: span 12;
    }
  }

  :global(.widget-wrap.drag-over) {
    outline-color: oklch(var(--primary));
    background: color-mix(in oklab, oklch(var(--primary)) 8%, transparent);
    border-radius: calc(var(--radius) + 0.35rem);
  }

  .widget-controls {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.4rem;
    margin-bottom: 0.25rem;
    background: oklch(var(--card));
    border: 1px solid oklch(var(--border));
    border-radius: var(--radius);
    width: fit-content;
  }

  .drag-handle {
    display: flex;
    align-items: center;
    color: oklch(var(--muted-foreground));
    padding: 0 0.15rem;
    cursor: grab;
  }

  .widget-ctrl-btn {
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid oklch(var(--border));
    border-radius: calc(var(--radius) - 2px);
    background: oklch(var(--muted));
    color: oklch(var(--foreground));
    padding: 0.1rem 0.45rem;
    cursor: pointer;
    transition: background-color 100ms ease;
  }

  .widget-ctrl-btn:hover {
    background: oklch(var(--accent));
    color: oklch(var(--accent-foreground));
    border-color: oklch(var(--accent));
  }

  .widget-ctrl-btn--hide {
    color: oklch(var(--muted-foreground));
  }

  .widget-ctrl-btn--hide:hover {
    background: oklch(var(--destructive) / 15%);
    color: oklch(var(--destructive));
    border-color: oklch(var(--destructive) / 40%);
  }

  .hidden-restore {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px dashed oklch(var(--border));
    border-radius: calc(var(--radius) + 0.35rem);
    background: oklch(var(--muted) / 40%);
  }

  .hidden-restore-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: oklch(var(--muted-foreground));
    margin-right: 0.25rem;
  }

  .hidden-restore-btn {
    font-size: 0.76rem;
    font-weight: 600;
    border: 1px solid oklch(var(--border));
    border-radius: 999px;
    background: oklch(var(--card));
    color: oklch(var(--foreground));
    padding: 0.2rem 0.65rem;
    cursor: pointer;
    transition: background-color 100ms ease, border-color 100ms ease;
  }

  .hidden-restore-btn:hover {
    background: oklch(var(--accent));
    color: oklch(var(--accent-foreground));
    border-color: oklch(var(--accent));
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .row strong {
    font-weight: 650;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .row--note {
    align-items: flex-start;
    border-radius: var(--radius);
    padding: 0.2rem 0.35rem;
    margin: 0 -0.35rem;
    transition: background-color 120ms ease, border-color 120ms ease;
    border: 1px solid transparent;
  }

  .row--note:focus-visible {
    outline: none;
    border-color: oklch(var(--ring));
    background: oklch(var(--card));
  }

  .row-note-main {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
  }

  .note-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    color: oklch(var(--muted-foreground));
  }

  .note-flag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid oklch(var(--border));
    background: oklch(var(--muted));
    color: oklch(var(--muted-foreground));
    padding: 0.16rem;
    white-space: nowrap;
  }

  .note-flag--pinned {
    border-color: color-mix(in oklab, oklch(var(--border)) 70%, oklch(var(--chart-2)) 30%);
    background: color-mix(in oklab, oklch(var(--muted)) 82%, oklch(var(--chart-2)) 18%);
    color: color-mix(in oklab, oklch(var(--foreground)) 55%, oklch(var(--chart-2)) 45%);
  }

  .note-flag--favorite {
    border-color: color-mix(in oklab, oklch(var(--border)) 66%, oklch(var(--chart-1)) 34%);
    background: color-mix(in oklab, oklch(var(--muted)) 80%, oklch(var(--chart-1)) 20%);
    color: color-mix(in oklab, oklch(var(--foreground)) 58%, oklch(var(--chart-1)) 42%);
  }

  .note-path {
    color: oklch(var(--muted-foreground));
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: min(100%, 45ch);
  }

  .note-time {
    color: oklch(var(--muted-foreground));
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: min(100%, 45ch);
    opacity: 0.7;
  }

  .status-right {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .latency {
    color: oklch(var(--muted-foreground));
    font-size: 0.78rem;
    font-family: var(--font-mono, monospace);
  }

  .note-open {
    color: oklch(var(--foreground));
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 600;
    border-radius: 999px;
    border: 1px solid oklch(var(--border));
    background: oklch(var(--muted));
    padding: 0.2rem 0.52rem;
    transition: border-color 120ms ease, background-color 120ms ease;
    white-space: nowrap;
  }

  .note-open:hover,
  .note-open:focus-visible {
    border-color: oklch(var(--ring));
    background: color-mix(in oklab, oklch(var(--muted)) 74%, oklch(var(--card)) 26%);
    outline: none;
  }

  .note-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.38rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .note-copy-feedback {
    margin: 0;
    color: oklch(var(--muted-foreground));
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .note-copy {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: oklch(var(--muted-foreground));
    text-decoration: none;
    font-size: 0.74rem;
    font-weight: 560;
    border-radius: 999px;
    border: 1px solid oklch(var(--border));
    background: transparent;
    padding: 0.2rem 0.52rem;
    transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;
    white-space: nowrap;
    cursor: pointer;
  }

  .note-copy:hover,
  .note-copy:focus-visible {
    border-color: oklch(var(--ring));
    color: oklch(var(--foreground));
    background: oklch(var(--muted));
    outline: none;
  }

  .note-copy--copied {
    border-color: color-mix(in oklab, oklch(var(--border)) 58%, oklch(var(--chart-2)) 42%);
    color: color-mix(in oklab, oklch(var(--foreground)) 62%, oklch(var(--chart-2)) 38%);
    background: color-mix(in oklab, oklch(var(--muted)) 74%, oklch(var(--chart-2)) 26%);
  }

  .row.link {
    text-decoration: none;
    border-radius: var(--radius);
    border: 1px solid transparent;
    padding: 0.45rem 0.55rem;
    margin: 0 -0.55rem;
    transition: border-color 120ms ease, background-color 120ms ease;
  }

  .row.link:hover {
    border-color: oklch(var(--border));
    background: oklch(var(--card));
  }

  .spin {
    animation: spin 850ms linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .empty {
    margin: 0;
    color: oklch(var(--muted-foreground));
    font-size: 0.9rem;
  }

  .empty-detail {
    margin: 0;
    color: oklch(var(--destructive));
    font-size: 0.8rem;
    line-height: 1.35;
  }

  @media (min-width: 920px) {
    .control-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }
  }

  @media (min-width: 1360px) {
    .control-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

</style>
