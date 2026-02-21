<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import type { DashboardEvent, DashboardMonitor, DashboardTodo } from '@notedash/types';
  import type { DashboardWidget } from '$lib/widgets/types';
  import WidgetCard from '$lib/components/WidgetCard.svelte';
  import { tryLoadCoreWasm } from '$lib/core/wasm';
  import { fetchRssItems } from '$lib/adapters/rss';
  import { fetchUptimeKumaStatus } from '$lib/adapters/uptime-kuma';
  import { buildInitialWidgets } from '$lib/widgets/registry';

  /**
   * Holds the initial widget registry output.
   */
  let widgets: DashboardWidget[] = buildInitialWidgets();

  onMount(async () => {
    const wasm = await tryLoadCoreWasm();

    const agendaWidget = widgets.find((widget) => widget.kind === 'agenda');
    if (wasm && agendaWidget && agendaWidget.data.length > 0) {
      replaceWidgetData('agenda', safeNormalizeEvents(wasm.normalize_events, agendaWidget.data));
    }

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
      replaceWidgetData('rss', rssItems.slice(0, 12));
    }

    if (monitors.length > 0) {
      const normalized = wasm ? safeNormalizeMonitors(wasm.normalize_monitors, monitors) : monitors;
      replaceWidgetData('status', normalized);
    }
  });

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
      <WidgetCard title={widget.title} size={widget.size}>
        {#if widget.kind === 'agenda'}
          {#each widget.data as item}
            <div class="row">
              <strong>{item.title}</strong>
              <span>{new Date(item.startsAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          {/each}
        {:else if widget.kind === 'todos'}
          {#each widget.data as item}
            <div class="row mono">
              <span>[{todoSymbol(item)}]</span>
              <span>{item.title}</span>
            </div>
          {/each}
        {:else if widget.kind === 'notes'}
          {#each widget.data as item}
            <div class="row">
              <strong>{item.title}</strong>
              <span>{item.path}</span>
            </div>
          {/each}
        {:else if widget.kind === 'rss'}
          {#each widget.data as item}
            <a class="row link" href={item.link} target="_blank" rel="noreferrer">
              <strong>{item.title}</strong>
              <span>{item.source}</span>
            </a>
          {/each}
        {:else if widget.kind === 'status'}
          {#each widget.data as item}
            <div class="row">
              <strong>{item.name}</strong>
              <span class={`status ${monitorClass(item.state)}`}>{item.state}</span>
            </div>
          {/each}
        {:else if widget.kind === 'email-links'}
          {#each widget.data as item}
            <a class="row link" href={item.href} target="_blank" rel="noreferrer">
              <strong>{item.label}</strong>
              <span>Open inbox</span>
            </a>
          {/each}
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
</style>
