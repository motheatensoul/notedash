<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import type { DashboardEvent, DashboardMonitor, DashboardTodo } from '@notedash/types';
  import type { DashboardWidget } from '$lib/widgets/types';
  import WidgetCard from '$lib/components/WidgetCard.svelte';
  import { tryLoadCoreWasm } from '$lib/core/wasm';
  import { readCacheEntry, writeCache } from '$lib/cache/ttl-cache';
  import { fetchCaldavAgenda } from '$lib/adapters/caldav';
  import { fetchRecentNotes } from '$lib/adapters/obsidian';
  import { parseEmailProviders, resolveEmailLinks } from '$lib/adapters/email';
  import { fetchRssItems } from '$lib/adapters/rss';
  import { fetchUptimeKumaStatus } from '$lib/adapters/uptime-kuma';
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
    const wasm = await tryLoadCoreWasm();
    const rssCacheTtlSeconds = readPositiveInt(env.PUBLIC_RSS_CACHE_TTL_SECONDS, 600);
    const statusCacheTtlSeconds = readPositiveInt(env.PUBLIC_STATUS_CACHE_TTL_SECONDS, 60);
    const refreshSeconds = readPositiveInt(env.PUBLIC_FEED_STATUS_REFRESH_SECONDS, 180);

    const agendaWidget = widgets.find((widget) => widget.kind === 'agenda');
    if (wasm && agendaWidget && agendaWidget.data.length > 0) {
      replaceWidgetData('agenda', safeNormalizeEvents(wasm.normalize_events, agendaWidget.data));
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

    const [caldavAgenda, notes, emailLinks] = await Promise.all([
      fetchCaldavAgenda({
        serverUrl: env.PUBLIC_CALDAV_CALENDAR_URL ?? '',
        todoUrl: env.PUBLIC_CALDAV_TODO_URL ?? '',
        lookaheadDays: 45
      }),
      fetchRecentNotes({
        vaultPath: env.PUBLIC_OBSIDIAN_VAULT_PATH ?? '',
        limit: 12
      }),
      resolveEmailLinks({
        providers: parseEmailProviders(env.PUBLIC_EMAIL_LINKS ?? '')
      })
    ]);

    if (caldavAgenda.events.length > 0) {
      const normalized = wasm
        ? safeNormalizeEvents(wasm.normalize_events, caldavAgenda.events)
        : caldavAgenda.events;
      replaceWidgetData('agenda', normalized.slice(0, 12));
    }
    setWidgetState('agenda', 'ok');
    setWidgetSubtitle('agenda', 'Read-only CalDAV');

    if (caldavAgenda.todos.length > 0) {
      replaceWidgetData('todos', caldavAgenda.todos.slice(0, 12));
    }
    setWidgetState('todos', 'ok');
    setWidgetSubtitle('todos', 'Read-only CalDAV');

    if (notes.length > 0) {
      replaceWidgetData('notes', notes);
    }
    setWidgetState('notes', 'ok');
    setWidgetSubtitle('notes', notes.length > 0 ? `Updated ${formatRelativeIso(notes[0].updatedAtIso)}` : '');

    if (emailLinks.length > 0) {
      replaceWidgetData('email-links', emailLinks);
    }
    setWidgetState('email-links', 'ok');
    setWidgetSubtitle('email-links', `${emailLinks.length} inbox links`);

    await refreshRssAndStatus(
      wasm,
      rssCacheTtlSeconds,
      statusCacheTtlSeconds,
      cachedRss != null,
      cachedStatus != null
    );

    refreshIntervalId = setInterval(() => {
      void refreshRssAndStatus(
        wasm,
        rssCacheTtlSeconds,
        statusCacheTtlSeconds,
        widgetState.rss === 'stale' || widgetState.rss === 'ok',
        widgetState.status === 'stale' || widgetState.status === 'ok'
      );
    }, refreshSeconds * 1000);

    freshnessIntervalId = setInterval(() => {
      refreshFreshnessSubtitles();
    }, 15000);
  }

  /**
   * Refreshes RSS and service status widgets and updates local cache.
   */
  async function refreshRssAndStatus(
    wasm: Awaited<ReturnType<typeof tryLoadCoreWasm>>,
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

    const rssConfigured = (env.PUBLIC_RSS_FEED_URLS ?? '').trim().length > 0;
    const statusConfigured = (env.PUBLIC_UPTIME_KUMA_STATUS_URL ?? '').trim().length > 0;

    const [rssItems, monitors] = await Promise.all([
      fetchRssItems({
        feedUrls: (env.PUBLIC_RSS_FEED_URLS ?? '')
          .split(',')
          .map((value: string) => value.trim())
          .filter(Boolean)
      }),
      fetchUptimeKumaStatus({ statusPageUrl: env.PUBLIC_UPTIME_KUMA_STATUS_URL ?? '' })
    ]);

    if (rssItems.length > 0) {
      const sliced = rssItems.slice(0, 12);
      replaceWidgetData('rss', sliced);
      writeCache(RSS_CACHE_KEY, sliced, rssCacheTtlSeconds);
      setWidgetState('rss', 'ok');
      setWidgetFreshness('rss', 'updated', Date.now());
    } else if (hadCachedRss) {
      setWidgetState('rss', 'stale');
    } else if (rssConfigured) {
      setWidgetState('rss', 'error');
    } else {
      setWidgetState('rss', 'ok');
    }

    if (monitors.length > 0) {
      const normalized = wasm ? safeNormalizeMonitors(wasm.normalize_monitors, monitors) : monitors;
      replaceWidgetData('status', normalized);
      writeCache(STATUS_CACHE_KEY, normalized, statusCacheTtlSeconds);
      setWidgetState('status', 'ok');
      setWidgetFreshness('status', 'updated', Date.now());
    } else if (hadCachedStatus) {
      setWidgetState('status', 'stale');
    } else if (statusConfigured) {
      setWidgetState('status', 'error');
    } else {
      setWidgetState('status', 'ok');
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
   * Parses a positive integer from string input with fallback.
   */
  function readPositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
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

<main>
  <section class="hero">
    <p class="label">Notedash</p>
    <h1>Your daily control center</h1>
    <p>
      One place for calendar, tasks, notes, feeds, service status, and quick inbox access.
    </p>
  </section>

  <section class="grid">
    {#each widgets as widget}
      <WidgetCard
        title={widget.title}
        size={widget.size}
        status={widgetState[widget.kind]}
        subtitle={widgetSubtitle[widget.kind]}
      >
        {#if widget.kind === 'agenda'}
          {#if widget.data.length === 0}
            <p class="empty">No upcoming events loaded.</p>
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
            <p class="empty">No open tasks loaded.</p>
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
            <p class="empty">No notes found for the current vault path.</p>
          {:else}
            {#each widget.data as item}
              <div class="row">
                <strong>{item.title}</strong>
                <span>{item.path}</span>
              </div>
            {/each}
          {/if}
        {:else if widget.kind === 'rss'}
          {#if widget.data.length === 0}
            {#if widgetState.rss === 'loading'}
              <p class="empty">Loading feed items...</p>
            {:else if widgetState.rss === 'error'}
              <p class="empty">Feed refresh failed. Verify RSS URLs and CORS.</p>
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
          {#if widget.data.length === 0}
            {#if widgetState.status === 'loading'}
              <p class="empty">Loading service status...</p>
            {:else if widgetState.status === 'error'}
              <p class="empty">Status refresh failed. Verify the Uptime Kuma URL.</p>
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
</style>
