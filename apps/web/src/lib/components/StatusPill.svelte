<script context="module" lang="ts">
  /**
   * Defines semantic color variants shared across widget status pills.
   */
  export type StatusPillTone = 'ok' | 'warn' | 'down' | 'loading' | 'stale' | 'error';
</script>

<script lang="ts">
  /**
   * Controls semantic color treatment for the pill.
   */
  export let tone: StatusPillTone = 'ok';

  /**
   * Controls text casing/size style for different contexts.
   */
  export let variant: 'compact' | 'regular' = 'regular';

  /**
   * Provides optional tooltip detail text.
   */
  export let title: string | undefined = undefined;
</script>

<span class={`status-pill ${tone} ${variant}`} title={title}>
  <slot />
</span>

<style>
  .status-pill {
    border-radius: 999px;
    line-height: 1.1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    white-space: nowrap;
  }

  .status-pill.compact {
    padding: 0.12rem 0.52rem;
    text-transform: uppercase;
    font-size: 0.67rem;
    letter-spacing: 0.06em;
    font-weight: 800;
  }

  .status-pill.regular {
    padding: 0.12rem 0.6rem;
    text-transform: capitalize;
    font-size: 0.8rem;
  }

  .status-pill.ok {
    background: oklch(var(--accent));
    color: oklch(var(--accent-foreground));
  }

  .status-pill.warn,
  .status-pill.loading {
    background: color-mix(in oklab, oklch(var(--primary)) 18%, oklch(var(--background)) 82%);
    color: color-mix(in oklab, oklch(var(--primary)) 72%, oklch(var(--foreground)) 28%);
  }

  .status-pill.down,
  .status-pill.error {
    background: color-mix(in oklab, oklch(var(--destructive)) 16%, oklch(var(--background)) 84%);
    color: oklch(var(--destructive));
  }

  .status-pill.stale {
    background: color-mix(in oklab, oklch(var(--secondary)) 86%, oklch(var(--background)) 14%);
    color: color-mix(in oklab, oklch(var(--foreground)) 62%, oklch(var(--muted-foreground)) 38%);
  }
</style>
