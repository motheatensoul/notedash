<script lang="ts">
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
   */
  export let size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Describes the current state of widget data.
   */
  export let status: WidgetCardStatus = 'ok';

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
</script>

<section class={`card ${size}`}>
  <header>
    <span>{title}</span>
    <span class={`status ${status}`}>{statusLabel(status)}</span>
  </header>
  <div class="body">
    <slot />
  </div>
</section>

<style>
  .card {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 0.8rem;
    border-radius: var(--nd-radius-lg);
    border: 1px solid var(--nd-border);
    background: var(--nd-surface);
    backdrop-filter: blur(4px);
    box-shadow: var(--nd-shadow);
    padding: 1rem;
    animation: rise-in 280ms ease both;
  }

  .card.small {
    grid-column: span 3;
  }

  .card.medium {
    grid-column: span 4;
  }

  .card.large {
    grid-column: span 6;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    font-size: 1rem;
  }

  .status {
    border-radius: 999px;
    padding: 0.12rem 0.52rem;
    text-transform: uppercase;
    font-size: 0.67rem;
    letter-spacing: 0.06em;
    font-weight: 800;
    line-height: 1.1;
  }

  .status.ok {
    color: #0b7a42;
    background: #dff5eb;
  }

  .status.loading {
    color: #925500;
    background: #fff1d6;
  }

  .status.stale {
    color: #15537a;
    background: #dff0ff;
  }

  .status.error {
    color: #b42318;
    background: #fde8e8;
  }

  .body {
    display: grid;
    gap: 0.6rem;
    color: var(--nd-text-muted);
    font-size: 0.93rem;
  }

  @media (max-width: 1100px) {
    .card.small,
    .card.medium,
    .card.large {
      grid-column: span 6;
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
