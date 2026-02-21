<script context="module" lang="ts">
  /**
   * Defines one setup checklist requirement row.
   */
  export interface SetupChecklistItem {
    id: string;
    label: string;
    description: string;
    complete: boolean;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /**
   * Provides checklist rows to render.
   */
  export let items: SetupChecklistItem[] = [];

  const dispatch = createEventDispatcher<{ openOnboarding: undefined }>();

  $: completedCount = items.filter((item) => item.complete).length;
  $: totalCount = items.length;
  $: isComplete = totalCount > 0 && completedCount === totalCount;
</script>

<section class="checklist">
  <header>
    <div>
      <h2>Setup Checklist</h2>
      <p>{completedCount}/{totalCount} integrations configured</p>
    </div>
    <button type="button" class="action-btn" on:click={() => dispatch('openOnboarding')}>
      {isComplete ? 'Edit setup' : 'Finish setup'}
    </button>
  </header>

  <ul>
    {#each items as item}
      <li class:complete={item.complete}>
        <span class="dot" aria-hidden="true"></span>
        <div>
          <strong>{item.label}</strong>
          <small>{item.description}</small>
        </div>
      </li>
    {/each}
  </ul>
</section>

<style>
  .checklist {
    border-radius: var(--nd-radius-lg);
    border: 1px solid var(--nd-border);
    background: var(--nd-surface);
    backdrop-filter: blur(4px);
    box-shadow: var(--nd-shadow);
    padding: 1rem;
    display: grid;
    gap: 0.8rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  p {
    margin: 0.2rem 0 0;
    font-size: 0.84rem;
    color: var(--nd-text-muted);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.45rem;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    border-radius: var(--nd-radius-md);
    border: 1px solid var(--nd-border);
    background: var(--nd-surface-strong);
    padding: 0.45rem 0.6rem;
  }

  .dot {
    width: 0.62rem;
    height: 0.62rem;
    border-radius: 999px;
    margin-top: 0.28rem;
    background: #c7d0d6;
    flex-shrink: 0;
  }

  li.complete .dot {
    background: #0b7a42;
  }

  li strong {
    display: block;
    font-size: 0.9rem;
  }

  li small {
    color: var(--nd-text-muted);
    font-size: 0.8rem;
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
    flex-shrink: 0;
  }

  @media (max-width: 900px) {
    header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
