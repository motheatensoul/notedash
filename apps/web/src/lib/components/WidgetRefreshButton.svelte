<script lang="ts">
  import { RefreshCw } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

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
  <Button type="button" variant="secondary" size="sm" onclick={onRefresh} {disabled}>
    <span class:spin={disabled}>
      <RefreshCw class="icon" size={14} aria-hidden="true" />
    </span>
    {disabled ? loadingLabel : idleLabel}
  </Button>
</div>

<style>
  .widget-actions {
    display: flex;
    justify-content: flex-end;
  }

  .spin {
    animation: spin 800ms linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
