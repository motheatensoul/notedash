<script lang="ts">
  import StatusPill, { type StatusPillTone } from '$lib/components/StatusPill.svelte';

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
   * Provides the user-facing label for the status badge.
   */
  function statusLabel(value: WidgetCardStatus): string {
    if (value === 'ok') {
      return 'Fresh';
    }

    if (value === 'loading') {
      return 'Loading';
    }

    if (value === 'stale') {
      return 'Cached';
    }

    return 'Error';
  }

  /**
   * Maps widget card status values to shared status pill tones.
   */
  function statusTone(value: WidgetCardStatus): StatusPillTone {
    return value;
  }
</script>

<section class={`card ${size} rounded-[calc(var(--radius)+0.35rem)] border bg-card/95 p-4 shadow-sm backdrop-blur-sm`}>
  <header class="flex items-center justify-between gap-3 text-base font-bold tracking-[0.01em]">
    <div class="title-wrap">
      <span>{title}</span>
      {#if subtitle}
        <small class="text-muted-foreground">{subtitle}</small>
      {/if}
    </div>
    <StatusPill tone={statusTone(status)} variant="compact" title={statusDetail}>
      {statusLabel(status)}
    </StatusPill>
  </header>
  <div class="body text-muted-foreground">
    <slot />
  </div>
</section>

<style>
  .card {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 0.8rem;
    animation: rise-in 280ms ease both;
  }

  .card.small {
    grid-column: span 3;
    min-height: 220px;
  }

  .card.medium {
    grid-column: span 4;
    min-height: 260px;
  }

  .card.large {
    grid-column: span 6;
    min-height: 280px;
  }

  .card.full {
    grid-column: span 12;
    min-height: 200px;
  }

  .title-wrap {
    display: grid;
    gap: 0.2rem;
  }

  small {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .body {
    display: grid;
    gap: 0.6rem;
    font-size: 0.93rem;
    max-height: 520px;
    overflow-y: auto;
  }

  @media (max-width: 1100px) {
    .card.small,
    .card.medium,
    .card.large {
      grid-column: span 6;
    }

    .card.full {
      grid-column: span 12;
    }
  }

  @keyframes rise-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
