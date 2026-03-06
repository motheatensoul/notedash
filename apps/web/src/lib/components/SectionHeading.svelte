<script lang="ts">
  /**
   * Provides the heading text rendered as the section title.
   */
  export let title: string;

  /**
   * Provides optional supporting copy displayed under the title.
   */
  export let description = '';

  /**
   * Provides an optional identifier applied to the heading element.
   */
  export let headingId: string | undefined = undefined;

  /**
   * Controls optional uppercase eyebrow text rendered above the heading.
   */
  export let eyebrow = '';

  /**
   * Controls heading visual scale and spacing.
   */
  export let variant: 'section' | 'hero' = 'section';

  /**
   * Controls semantic heading level.
   */
  export let level: 1 | 2 = 2;
</script>

<div class={`section-heading ${variant}`}>
  {#if eyebrow}
    <p class="eyebrow">{eyebrow}</p>
  {/if}

  {#if level === 1}
    <h1 id={headingId}>{title}</h1>
  {:else}
    <h2 id={headingId}>{title}</h2>
  {/if}

  {#if description}
    <p class="description">{description}</p>
  {/if}
</div>

<style>
  .section-heading {
    display: grid;
    gap: 0.2rem;
    padding: 0 0.1rem;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: oklch(var(--primary));
    font-weight: 700;
    font-size: 0.73rem;
  }

  .section-heading h2 {
    margin: 0;
    font-size: 1.1rem;
    letter-spacing: -0.01em;
  }

  .description {
    margin: 0;
    font-size: 0.88rem;
    color: oklch(var(--muted-foreground));
  }

  .hero {
    gap: 0.35rem;
  }

  .hero h1 {
    margin: 0;
    font-size: clamp(1.8rem, 4vw, 2.5rem);
    letter-spacing: -0.02em;
    line-height: 1.07;
  }

  .hero .description {
    max-width: 65ch;
    font-size: 1.02rem;
  }
</style>
