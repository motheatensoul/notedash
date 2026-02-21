<script lang="ts">
  /**
   * Handles refresh action invocation.
   */
  export let onRefresh: () => void;

  /**
   * Controls button disabled state.
   */
  export let disabled = false;

  /**
   * Label shown when refresh action is in progress.
   */
  export let loadingLabel = 'Refreshing...';

  /**
   * Label shown when refresh action is idle.
   */
  export let idleLabel = 'Refresh';
</script>

<div class="widget-actions">
  <button type="button" class="action-btn" on:click={onRefresh} {disabled}>
    {disabled ? loadingLabel : idleLabel}
  </button>
</div>

<style>
  .widget-actions {
    display: flex;
    justify-content: flex-end;
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

  .action-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }
</style>
