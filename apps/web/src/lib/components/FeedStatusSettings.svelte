<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { RuntimeSettings } from '$lib/settings/runtime-settings';

  /**
   * Holds the editable feed/status settings draft.
   */
  export let draft: RuntimeSettings;

  /**
   * Holds short status text for save/apply actions.
   */
  export let statusMessage = '';

  const dispatch = createEventDispatcher<{
    save: { draft: RuntimeSettings };
    reset: undefined;
    resetSetup: undefined;
  }>();

  /**
   * Emits a save event with the current draft values.
   */
  function handleSave(): void {
    dispatch('save', { draft });
  }

  /**
   * Emits a reset request event.
   */
  function handleReset(): void {
    dispatch('reset');
  }

  /**
   * Emits a request to clear saved setup and reopen onboarding.
   */
  function handleResetSetup(): void {
    dispatch('resetSetup');
  }
</script>

<section class="settings-panel">
  <h2>Feed and Status Settings</h2>
  <form class="settings-form" on:submit|preventDefault={handleSave}>
    <label>
      RSS sources (comma-separated)
      <textarea
        rows="3"
        bind:value={draft.rssFeedUrls}
        placeholder="https://hnrss.org/frontpage,https://planet.svelte.dev/rss.xml"
      ></textarea>
    </label>

    <label>
      Uptime Kuma status URL
      <input
        type="url"
        bind:value={draft.uptimeKumaStatusUrl}
        placeholder="https://status.example.com/status/main"
      />
    </label>

    <div class="settings-row">
      <label>
        Refresh interval (seconds)
        <input type="number" min="15" step="1" bind:value={draft.refreshSeconds} />
      </label>

      <label>
        RSS cache TTL (seconds)
        <input type="number" min="30" step="1" bind:value={draft.rssCacheTtlSeconds} />
      </label>

      <label>
        Status cache TTL (seconds)
        <input type="number" min="15" step="1" bind:value={draft.statusCacheTtlSeconds} />
      </label>
    </div>

    <div class="settings-actions">
      <button class="action-btn" type="submit">Save and Apply</button>
      <button class="action-btn secondary" type="button" on:click={handleReset}>Reset Draft</button>
      <button class="action-btn danger" type="button" on:click={handleResetSetup}>Reset Setup</button>
    </div>

    {#if statusMessage}
      <p class="settings-status">{statusMessage}</p>
    {/if}
  </form>
</section>

<style>
  .settings-panel {
    border-radius: var(--nd-radius-lg);
    border: 1px solid var(--nd-border);
    background: var(--nd-surface);
    backdrop-filter: blur(4px);
    box-shadow: var(--nd-shadow);
    padding: 1rem;
    display: grid;
    gap: 0.8rem;
  }

  .settings-panel h2 {
    margin: 0;
    font-size: 1rem;
  }

  .settings-form {
    display: grid;
    gap: 0.8rem;
  }

  .settings-form label {
    display: grid;
    gap: 0.32rem;
    font-size: 0.85rem;
    color: var(--nd-text-muted);
    font-weight: 650;
  }

  .settings-form input,
  .settings-form textarea {
    width: 100%;
    border-radius: var(--nd-radius-md);
    border: 1px solid var(--nd-border);
    background: var(--nd-surface-strong);
    color: var(--nd-text);
    padding: 0.5rem 0.6rem;
    font: inherit;
  }

  .settings-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .settings-actions {
    display: flex;
    gap: 0.55rem;
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

  .action-btn.secondary {
    background: transparent;
  }

  .action-btn.danger {
    color: var(--nd-danger);
    border-color: color-mix(in oklab, var(--nd-danger) 35%, white);
  }

  .settings-status {
    margin: 0;
    color: var(--nd-text-muted);
    font-size: 0.84rem;
  }

  @media (max-width: 900px) {
    .settings-row {
      grid-template-columns: 1fr;
    }
  }
</style>
