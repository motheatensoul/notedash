<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import type { DashboardEvent, DashboardMonitor, DashboardTodo } from '@notedash/types';
  import type { DashboardWidget } from '$lib/widgets/types';
  import SetupChecklist, { type SetupChecklistItem } from '$lib/components/SetupChecklist.svelte';
  import FeedStatusSettings from '$lib/components/FeedStatusSettings.svelte';
  import OnboardingModal from '$lib/components/OnboardingModal.svelte';
  import type { OnboardingDraft } from '$lib/onboarding/validation';
  import WidgetCard from '$lib/components/WidgetCard.svelte';
  import { tryLoadCoreWasm } from '$lib/core/wasm';
  import { deleteCache, readCacheEntry, writeCache } from '$lib/cache/ttl-cache';
  import {
    loadRuntimeSettings,
    runtimeSettingsFromPublicEnv,
    sanitizeRuntimeSettings,
    saveRuntimeSettings,
    type RuntimeSettings
  } from '$lib/settings/runtime-settings';
  import {
    loadUserProfileSettings,
    saveUserProfileSettings,
    sanitizeUserProfileSettings,
    userProfileDefaultsFromPublicEnv,
    type UserProfileSettings
  } from '$lib/settings/user-profile-settings';
  import { fetchCaldavAgendaDetailed } from '$lib/adapters/caldav';
  import { fetchRecentNotesDetailed } from '$lib/adapters/obsidian';
  import { parseEmailProviders, resolveEmailLinks } from '$lib/adapters/email';
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
  let widgetState: Record<DashboardWidget['kind'], WidgetRuntimeState> = {
    agenda: 'loading',
    todos: 'loading',
    notes: 'loading',
    rss: 'loading',
    status: 'loading',
    'email-links': 'loading'
  };

  /**
   * Tracks optional widget subtitle metadata.
   */
  let widgetSubtitle: Partial<Record<DashboardWidget['kind'], string>> = {};

  /**
   * Tracks optional diagnostic error details per widget.
   */
  let widgetErrorDetail: Partial<Record<DashboardWidget['kind'], string>> = {};

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
   * Holds persisted feed/status override settings.
   */
  const runtimeSettingsDefaults = runtimeSettingsFromPublicEnv(env);
  let runtimeSettings: RuntimeSettings = loadRuntimeSettings(runtimeSettingsDefaults);
  const userProfileDefaults = userProfileDefaultsFromPublicEnv(env);
  let userProfile: UserProfileSettings = loadUserProfileSettings(userProfileDefaults);

  /**
   * Holds editable settings panel draft values.
   */
  let settingsDraft: RuntimeSettings = { ...runtimeSettings };

  /**
   * Holds short status text for settings save actions.
   */
  let settingsStatusMessage = '';
  let onboardingStatusMessage = '';
  let onboardingOpen = !userProfile.onboardingCompleted;
  let onboardingDraft: OnboardingDraft = buildOnboardingDraft();

  $: setupChecklistItems = buildSetupChecklistItems();

  /**
   * Stores the loaded WASM module for reuse.
   */
  let wasmModule: Awaited<ReturnType<typeof tryLoadCoreWasm>> = null;

  onMount(() => {
    void bootDashboard();

    return () => {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
      }

      if (freshnessIntervalId) {
        clearInterval(freshnessIntervalId);
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

    const [caldavResult, notesResult, emailLinks] = await Promise.all([
      fetchCaldavAgendaDetailed({
        serverUrl: userProfile.caldavCalendarUrl,
        todoUrl: userProfile.caldavTodoUrl,
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
    applyCaldavWidgetState('todos', (userProfile.caldavTodoUrl || userProfile.caldavCalendarUrl).length > 0, caldavResult.errorDetail);
    setWidgetSubtitle('todos', 'Read-only CalDAV');

    if (notesResult.notes.length > 0) {
      replaceWidgetData('notes', notesResult.notes);
    }
    applyNotesWidgetState(userProfile.obsidianVaultPath.length > 0, notesResult.errorDetail);
    setWidgetSubtitle(
      'notes',
      notesResult.notes.length > 0 ? `Updated ${formatRelativeIso(notesResult.notes[0].updatedAtIso)}` : ''
    );

    if (emailLinks.length > 0) {
      replaceWidgetData('email-links', emailLinks);
    }
    setWidgetState('email-links', 'ok');
    setWidgetError('email-links');
    setWidgetSubtitle('email-links', `${emailLinks.length} inbox links`);

    await refreshRssAndStatus(
      rssCacheTtlSeconds,
      statusCacheTtlSeconds,
      cachedRss != null,
      cachedStatus != null
    );

    restartFeedStatusRefreshLoop();

    freshnessIntervalId = setInterval(() => {
      refreshFreshnessSubtitles();
    }, 15000);
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
   * Builds an onboarding draft from current profile and runtime settings.
   */
  function buildOnboardingDraft(): OnboardingDraft {
    return {
      emailProviderPreset: inferEmailPreset(userProfile.emailLinksRaw),
      customEmailUrl: inferCustomEmailUrl(userProfile.emailLinksRaw),
      additionalEmailLinks: inferAdditionalEmailLinks(userProfile.emailLinksRaw),
      rssFeedUrls: runtimeSettings.rssFeedUrls,
      uptimeKumaStatusUrl: runtimeSettings.uptimeKumaStatusUrl,
      caldavCalendarUrl: userProfile.caldavCalendarUrl,
      caldavTodoUrl: userProfile.caldavTodoUrl,
      obsidianVaultPath: userProfile.obsidianVaultPath
    };
  }

  /**
   * Completes onboarding and applies settings/profile values immediately.
   */
  async function completeOnboarding(draft: OnboardingDraft): Promise<void> {
    onboardingStatusMessage = 'Applying onboarding settings...';

    const sanitizedProfile = sanitizeUserProfileSettings(
      {
        onboardingCompleted: true,
        emailLinksRaw: composeEmailLinksRaw(draft),
        caldavCalendarUrl: draft.caldavCalendarUrl,
        caldavTodoUrl: draft.caldavTodoUrl,
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

    const [caldavResult, notesResult, emailLinks] = await Promise.all([
      fetchCaldavAgendaDetailed({
        serverUrl: userProfile.caldavCalendarUrl,
        todoUrl: userProfile.caldavTodoUrl,
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

    if (caldavResult.todos.length > 0) {
      replaceWidgetData('todos', caldavResult.todos.slice(0, 12));
    }
    applyCaldavWidgetState('todos', (userProfile.caldavTodoUrl || userProfile.caldavCalendarUrl).length > 0, caldavResult.errorDetail);

    if (notesResult.notes.length > 0) {
      replaceWidgetData('notes', notesResult.notes);
    }
    applyNotesWidgetState(userProfile.obsidianVaultPath.length > 0, notesResult.errorDetail);
    setWidgetSubtitle(
      'notes',
      notesResult.notes.length > 0 ? `Updated ${formatRelativeIso(notesResult.notes[0].updatedAtIso)}` : ''
    );

    replaceWidgetData('email-links', emailLinks);
    setWidgetSubtitle('email-links', `${emailLinks.length} inbox links`);

    deleteCache(RSS_CACHE_KEY);
    deleteCache(STATUS_CACHE_KEY);
    await refreshRssAndStatus(
      runtimeSettings.rssCacheTtlSeconds,
      runtimeSettings.statusCacheTtlSeconds,
      false,
      false
    );
    restartFeedStatusRefreshLoop();

    onboardingOpen = false;
    onboardingStatusMessage = 'Onboarding complete.';
    settingsStatusMessage = 'Applied onboarding settings.';
    onboardingDraft = buildOnboardingDraft();
  }

  /**
   * Marks onboarding as completed without overwriting existing settings.
   */
  function dismissOnboarding(): void {
    userProfile = sanitizeUserProfileSettings(
      {
        ...userProfile,
        onboardingCompleted: true
      },
      userProfileDefaults
    );
    saveUserProfileSettings(userProfile);
    onboardingOpen = false;
    onboardingStatusMessage = '';
  }

  /**
   * Reopens onboarding to edit provider and URL setup.
   */
  function openOnboarding(): void {
    onboardingDraft = buildOnboardingDraft();
    onboardingStatusMessage = '';
    onboardingOpen = true;
  }

  /**
   * Resolves provider preset from persisted email link configuration.
   */
  function inferEmailPreset(rawLinks: string): OnboardingDraft['emailProviderPreset'] {
    const lower = rawLinks.toLowerCase();
    if (lower.includes('fastmail.com')) {
      return 'fastmail';
    }
    if (lower.includes('mail.google.com')) {
      return 'gmail';
    }
    if (lower.includes('outlook.live.com') || lower.includes('outlook.office.com')) {
      return 'outlook';
    }
    if (lower.includes('mail.proton.me') || lower.includes('protonmail')) {
      return 'protonmail';
    }

    return 'custom';
  }

  /**
   * Extracts a custom URL candidate from the first configured email link.
   */
  function inferCustomEmailUrl(rawLinks: string): string {
    const first = rawLinks.split(',').map((value) => value.trim()).find(Boolean);
    if (!first) {
      return '';
    }

    const parts = first.split('|').map((value) => value.trim());
    return parts.length > 1 ? parts[1] : '';
  }

  /**
   * Extracts additional links beyond the first configured inbox entry.
   */
  function inferAdditionalEmailLinks(rawLinks: string): string {
    const entries = rawLinks
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (entries.length <= 1) {
      return '';
    }

    return entries.slice(1).join(',');
  }

  /**
   * Composes persisted email links from onboarding form values.
   */
  function composeEmailLinksRaw(draft: OnboardingDraft): string {
    const preset: Record<Exclude<OnboardingDraft['emailProviderPreset'], 'custom'>, string> = {
      fastmail: 'Fastmail|https://app.fastmail.com',
      gmail: 'Gmail|https://mail.google.com',
      outlook: 'Outlook|https://outlook.live.com',
      protonmail: 'Proton Mail|https://mail.proton.me'
    };

    const primary =
      draft.emailProviderPreset === 'custom'
        ? draft.customEmailUrl.trim()
          ? `Inbox|${draft.customEmailUrl.trim()}`
          : ''
        : preset[draft.emailProviderPreset];

    return [primary, draft.additionalEmailLinks.trim()].filter(Boolean).join(',');
  }

  /**
   * Builds checklist rows that summarize key onboarding setup completion.
   */
  function buildSetupChecklistItems(): SetupChecklistItem[] {
    const emailLinkCount = parseEmailProviders(userProfile.emailLinksRaw).length;
    const caldavConfigured = userProfile.caldavCalendarUrl.length > 0;
    const caldavHasError = widgetState.agenda === 'error' || widgetState.todos === 'error';
    const noteCount = widgets.find((widget) => widget.kind === 'notes')?.data.length ?? 0;

    return [
      {
        id: 'email',
        label: 'Email links',
        description:
          emailLinkCount === 0
            ? userProfile.emailLinksRaw.length > 0
              ? 'Links are configured but format is invalid. Use Label|URL entries.'
              : 'Add at least one inbox link.'
            : 'Inbox shortcuts configured.',
        complete: emailLinkCount > 0,
        state: emailLinkCount > 0 ? 'ok' : userProfile.emailLinksRaw.length > 0 ? 'warn' : 'todo'
      },
      {
        id: 'rss',
        label: 'RSS feeds',
        description:
          runtimeSettings.rssFeedUrls.length === 0
            ? 'Add one or more RSS source URLs.'
            : widgetState.rss === 'error'
              ? 'Configured, but the last refresh failed.'
              : 'Feed sources configured and refreshing.',
        complete: runtimeSettings.rssFeedUrls.length > 0 && widgetState.rss !== 'error',
        state:
          runtimeSettings.rssFeedUrls.length === 0
            ? 'todo'
            : widgetState.rss === 'error'
              ? 'warn'
              : 'ok'
      },
      {
        id: 'status',
        label: 'Service status',
        description:
          runtimeSettings.uptimeKumaStatusUrl.length === 0
            ? 'Add a Uptime Kuma status URL.'
            : widgetState.status === 'error'
              ? 'Configured, but the last status refresh failed.'
              : 'Uptime Kuma URL configured and refreshing.',
        complete: runtimeSettings.uptimeKumaStatusUrl.length > 0 && widgetState.status !== 'error',
        state:
          runtimeSettings.uptimeKumaStatusUrl.length === 0
            ? 'todo'
            : widgetState.status === 'error'
              ? 'warn'
              : 'ok'
      },
      {
        id: 'notes',
        label: 'Obsidian notes',
        description:
          userProfile.obsidianVaultPath.length === 0
            ? 'Add a desktop vault path for note indexing.'
            : noteCount > 0
              ? 'Vault path configured and notes detected.'
              : 'Vault path configured. No notes detected yet.',
        complete: userProfile.obsidianVaultPath.length > 0 && noteCount > 0,
        state:
          userProfile.obsidianVaultPath.length === 0
            ? 'todo'
            : noteCount > 0
              ? 'ok'
              : 'warn'
      },
      {
        id: 'caldav',
        label: 'CalDAV agenda',
        description:
          !caldavConfigured
            ? 'Add a CalDAV calendar collection URL.'
            : caldavHasError
              ? 'Configured, but the last CalDAV refresh failed.'
              : 'Calendar URL configured and refreshing.',
        complete: caldavConfigured && !caldavHasError,
        state: !caldavConfigured ? 'todo' : caldavHasError ? 'warn' : 'ok'
      }
    ];
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
   * Resets the editable settings draft to the currently active values.
   */
  function resetSettingsDraft(): void {
    settingsDraft = { ...runtimeSettings };
    settingsStatusMessage = 'Draft reset to active settings.';
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
  function applyNotesWidgetState(configured: boolean, errorDetail?: string): void {
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
  function monitorClass(state: DashboardMonitor['state']): string {
    if (state === 'up') {
      return 'ok';
    }
    if (state === 'degraded') {
      return 'warn';
    }
    return 'down';
  }

  /**
   * Selects the checkbox symbol for task rows.
   */
  function todoSymbol(todo: DashboardTodo): string {
    return todo.done ? 'x' : ' ';
  }
</script>

<OnboardingModal
  open={onboardingOpen}
  draft={onboardingDraft}
  statusMessage={onboardingStatusMessage}
  on:save={(event) => void completeOnboarding(event.detail.draft)}
  on:dismiss={dismissOnboarding}
/>

<main>
  <section class="hero">
    <p class="label">Notedash</p>
    <h1>Your daily control center</h1>
    <p>
      One place for calendar, tasks, notes, feeds, service status, and quick inbox access.
    </p>
    <button class="onboarding-btn" type="button" on:click={openOnboarding}>Edit onboarding setup</button>
  </section>

  <SetupChecklist items={setupChecklistItems} on:openOnboarding={openOnboarding} />

  <FeedStatusSettings
    draft={settingsDraft}
    statusMessage={settingsStatusMessage}
    on:save={(event) => void applyRuntimeSettings(event.detail.draft)}
    on:reset={resetSettingsDraft}
  />

  <section class="grid">
    {#each widgets as widget}
      <WidgetCard
        title={widget.title}
        size={widget.size}
        status={widgetState[widget.kind]}
        subtitle={widgetSubtitle[widget.kind]}
        statusDetail={widgetErrorDetail[widget.kind]}
      >
        {#if widget.kind === 'agenda'}
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
                <span>{new Date(item.startsAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            {/each}
          {/if}
        {:else if widget.kind === 'todos'}
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
              <div class="row mono">
                <span>[{todoSymbol(item)}]</span>
                <span>{item.title}</span>
              </div>
            {/each}
          {/if}
        {:else if widget.kind === 'notes'}
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
              <div class="row">
                <strong>{item.title}</strong>
                <span>{item.path}</span>
              </div>
            {/each}
          {/if}
        {:else if widget.kind === 'rss'}
          <div class="widget-actions">
            <button
              type="button"
              class="action-btn"
              on:click={() => void refreshFeedStatusNow()}
              disabled={manualRefreshState.rss || manualRefreshState.status}
            >
              {manualRefreshState.rss || manualRefreshState.status ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
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
                <span>{item.source}</span>
              </a>
            {/each}
          {/if}
        {:else if widget.kind === 'status'}
          <div class="widget-actions">
            <button
              type="button"
              class="action-btn"
              on:click={() => void refreshFeedStatusNow()}
              disabled={manualRefreshState.rss || manualRefreshState.status}
            >
              {manualRefreshState.rss || manualRefreshState.status ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
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
                <span class={`status ${monitorClass(item.state)}`}>{item.state}</span>
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
    {/each}
  </section>
</main>

<style>
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
    display: grid;
    gap: 1.2rem;
  }

  .hero {
    padding: 0.6rem 0.1rem;
  }

  .label {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--nd-accent);
    font-weight: 700;
    font-size: 0.73rem;
  }

  h1 {
    margin: 0.35rem 0;
    font-size: clamp(1.8rem, 4vw, 2.5rem);
  }

  .hero p {
    margin: 0;
    color: var(--nd-text-muted);
  }

  .onboarding-btn {
    margin-top: 0.7rem;
    appearance: none;
    border: 1px solid var(--nd-border);
    background: var(--nd-surface-strong);
    color: var(--nd-text);
    border-radius: 999px;
    padding: 0.35rem 0.8rem;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 1rem;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .row strong {
    color: var(--nd-text);
    font-weight: 650;
  }

  .row.link {
    text-decoration: none;
    border-radius: var(--nd-radius-md);
    border: 1px solid transparent;
    padding: 0.45rem 0.55rem;
    margin: 0 -0.55rem;
    transition: border-color 120ms ease, background-color 120ms ease;
  }

  .row.link:hover {
    border-color: var(--nd-border);
    background: var(--nd-surface-strong);
  }

  .mono {
    font-family: var(--nd-font-mono);
  }

  .status {
    border-radius: 999px;
    padding: 0.12rem 0.6rem;
    text-transform: capitalize;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .status.ok {
    background: #dff5eb;
    color: #0b7a42;
  }

  .status.warn {
    background: #fff1d6;
    color: #925500;
  }

  .status.down {
    background: #fde8e8;
    color: var(--nd-danger);
  }

  .empty {
    margin: 0;
    color: var(--nd-text-muted);
    font-size: 0.9rem;
  }

  .empty-detail {
    margin: 0;
    color: var(--nd-danger);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  .widget-actions {
    display: flex;
    justify-content: flex-end;
  }

  .action-btn {
    appearance: none;
    border: 1px solid var(--nd-border);
    background: var(--nd-surface-strong);
    color: var(--nd-text);
    border-radius: 999px;
    padding: 0.25rem 0.7rem;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .action-btn.secondary {
    background: transparent;
  }
</style>
