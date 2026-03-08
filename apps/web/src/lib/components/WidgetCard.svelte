<script lang="ts">
  import { GripVertical } from '@lucide/svelte';

  /**
   * Defines widget data freshness and loading states.
   */
  type WidgetCardStatus = 'loading' | 'ok' | 'stale' | 'error';

  /**
   * Holds the card title.
   */
  export let title: string;

  /**
   * Controls size classes for responsive dashboard layout.
   * - `small`: Narrow column span.
   * - `medium`: Standard column span.
   * - `large`: Wide column span.
   * - `full`: Full 12-column span.
   */
  export let size: 'small' | 'medium' | 'large' | 'full' = 'medium';

  /**
   * Describes the current state of widget data.
   */
  export let status: WidgetCardStatus = 'ok';

  /**
   * Displays optional auxiliary metadata such as last refresh time.
   */
  export let subtitle: string | undefined;

  /**
   * Provides optional diagnostic text for the status badge tooltip.
   */
  export let statusDetail: string | undefined;

  /**
   * Resolves the tooltip text for the status dot indicator.
   */
  function statusTooltip(value: WidgetCardStatus): string {
    if (statusDetail) return statusDetail;
    if (subtitle) return subtitle;
    const labels: Record<WidgetCardStatus, string> = {
      ok: 'Up to date',
      loading: 'Loading…',
      stale: 'Cached data',
      error: 'Error loading data'
    };
    return labels[value];
  }
</script>

<section class="card {size}">
  <header class="widget-header">
    <div class="header-left">
      <span class="grip-wrap" aria-hidden="true">
        <GripVertical size={13} />
      </span>
      <span class="widget-title">{title}</span>
      {#if subtitle && status === 'ok'}
        <span class="widget-subtitle">{subtitle}</span>
      {/if}
    </div>
    <span
      class="status-dot {status}"
      title={statusTooltip(status)}
      role="status"
      aria-label={statusTooltip(status)}
    ></span>
  </header>
  <div class="body">
    <slot />
  </div>
</section>

<style>
  /*
   * Card shell — flex column so body fills remaining height.
   * Glow border matches the reference: a thin primary-tinted ring + diffuse bloom.
   */
  .card {
    display: flex;
    flex-direction: column;
    min-height: 280px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 0.35rem);
    overflow: hidden;
    animation: rise-in 280ms ease both;
    box-shadow:
      0 0 0 1px color-mix(in oklch, var(--primary) 15%, transparent),
      0 0 20px -8px color-mix(in oklch, var(--primary) 20%, transparent);
  }

  /*
   * Size scale: 12-column fractions.
   *   small (3) + small (3) + medium (6) = 12
   *   large (9) + small (3)              = 12
   *   medium (6) + medium (6)            = 12
   */
  .card.small  { grid-column: span 3; }
  .card.medium { grid-column: span 6; }
  .card.large  { grid-column: span 9; }
  .card.full   { grid-column: span 12; }

  /* Header — compact, separated from body by a border */
  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .grip-wrap {
    display: inline-flex;
    align-items: center;
    color: color-mix(in oklch, var(--muted-foreground) 40%, transparent);
    flex-shrink: 0;
  }

  .widget-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .widget-subtitle {
    font-size: 0.7rem;
    color: color-mix(in oklch, var(--muted-foreground) 70%, transparent);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Status dot — replaces the text pill; only colored when non-ok */
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    flex-shrink: 0;
    background: color-mix(in oklch, var(--muted-foreground) 25%, transparent);
    transition: background-color 200ms ease;
  }

  .status-dot.ok      { background: color-mix(in oklch, var(--muted-foreground) 18%, transparent); }
  .status-dot.loading { background: color-mix(in oklch, var(--primary) 65%, transparent); animation: pulse 1.5s ease infinite; }
  .status-dot.stale   { background: color-mix(in oklch, var(--primary) 45%, transparent); }
  .status-dot.error   { background: color-mix(in oklch, var(--destructive) 80%, transparent); }

  /* Widget body — scrollable, padded */
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: grid;
    gap: 0.6rem;
    font-size: 0.875rem;
    color: var(--muted-foreground);
    max-height: 480px;
  }

  /* Tablet: large → full, small/medium → half */
  @media (max-width: 1100px) {
    .card.small,
    .card.medium { grid-column: span 6; }
    .card.large,
    .card.full   { grid-column: span 12; }
  }

  /* Mobile: all full width */
  @media (max-width: 640px) {
    .card.small,
    .card.medium,
    .card.large,
    .card.full   { grid-column: span 12; }
  }

  @keyframes rise-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
</style>
