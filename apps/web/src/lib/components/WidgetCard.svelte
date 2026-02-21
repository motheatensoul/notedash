<script lang="ts">
  /**
   * Holds the card title.
   */
  export let title: string;

  /**
   * Controls size classes for responsive dashboard layout.
   */
  export let size: 'small' | 'medium' | 'large' = 'medium';
</script>

<section class={`card ${size}`}>
  <header>{title}</header>
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
    font-weight: 700;
    letter-spacing: 0.01em;
    font-size: 1rem;
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
