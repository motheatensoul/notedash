<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import type { ObsidianTask } from '$lib/adapters/obsidian';

  /**
   * Controls whether the dialog is visible.
   */
  export let open = false;

  /**
   * Obsidian tasks that have no matching CalDAV todo.
   */
  export let conflicts: ObsidianTask[] = [];

  /**
   * Whether a resolution operation is in progress.
   */
  export let resolutionInProgress = false;

  const dispatch = createEventDispatcher<{
    resolve: { decisions: Map<string, 'keep' | 'discard'> };
    dismiss: undefined;
  }>();

  /**
   * Per-task decisions keyed by `filePath:lineNumber`.
   * Defaults to 'discard' (safe default — no unintended CalDAV writes).
   */
  let decisions = new Map<string, 'keep' | 'discard'>();

  $: if (conflicts) {
    decisions = new Map();
  }

  /**
   * Returns the decision for a given task, defaulting to 'discard'.
   */
  function getDecision(task: ObsidianTask): 'keep' | 'discard' {
    return decisions.get(`${task.filePath}:${task.lineNumber}`) ?? 'discard';
  }

  /**
   * Sets the decision for a given task.
   */
  function setDecision(task: ObsidianTask, decision: 'keep' | 'discard'): void {
    decisions = new Map(decisions).set(`${task.filePath}:${task.lineNumber}`, decision);
  }

  $: keptCount = conflicts.filter((t) => getDecision(t) === 'keep').length;

  function handleResolve(): void {
    dispatch('resolve', { decisions });
  }

  function handleDismiss(): void {
    dispatch('dismiss', undefined);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="task-sync-dialog">
    <Dialog.Header>
      <Dialog.Title>Obsidian tasks not in CalDAV</Dialog.Title>
      <Dialog.Description>
        These tasks exist in your vault but not in CalDAV. Choose to add them to CalDAV or discard
        them.
      </Dialog.Description>
    </Dialog.Header>

    <div class="conflict-list">
      {#each conflicts as task (task.filePath + ':' + task.lineNumber)}
        {@const decision = getDecision(task)}
        <div class="conflict-row">
          <div class="conflict-main">
            <strong class="conflict-title">{task.title}</strong>
            <span class="conflict-path">{task.filePath}</span>
          </div>
          <div class="conflict-actions">
            <Button
              size="sm"
              variant={decision === 'keep' ? 'default' : 'outline'}
              onclick={() => setDecision(task, 'keep')}
              disabled={resolutionInProgress}
            >
              Keep
            </Button>
            <Button
              size="sm"
              variant={decision === 'discard' ? 'secondary' : 'outline'}
              onclick={() => setDecision(task, 'discard')}
              disabled={resolutionInProgress}
            >
              Discard
            </Button>
          </div>
        </div>
      {/each}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={handleDismiss} disabled={resolutionInProgress}>
        Skip all
      </Button>
      <Button onclick={handleResolve} disabled={resolutionInProgress || keptCount === 0}>
        {resolutionInProgress ? 'Applying…' : `Add ${keptCount} to CalDAV`}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.task-sync-dialog) {
    width: min(640px, calc(100vw - 2rem));
  }

  .conflict-list {
    display: grid;
    gap: 0.6rem;
    max-height: 55vh;
    overflow-y: auto;
    padding: 0.1rem 0;
  }

  .conflict-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0.7rem;
    border-radius: var(--radius);
    border: 1px solid oklch(var(--border));
    background: oklch(var(--card));
  }

  .conflict-main {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
  }

  .conflict-title {
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conflict-path {
    color: oklch(var(--muted-foreground));
    font-size: 0.78rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conflict-actions {
    display: inline-flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }
</style>
