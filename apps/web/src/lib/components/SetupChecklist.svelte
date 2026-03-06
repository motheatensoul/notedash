<script context="module" lang="ts">
  export type { SetupChecklistItem } from '$lib/onboarding/checklist';
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import type { SetupChecklistItem } from '$lib/onboarding/checklist';

  /**
   * Provides checklist rows to render.
   */
  export let items: SetupChecklistItem[] = [];

  const dispatch = createEventDispatcher<{ openOnboarding: undefined; runChecks: undefined }>();

  $: completedCount = items.filter((item) => item.complete).length;
  $: totalCount = items.length;
  $: isComplete = totalCount > 0 && completedCount === totalCount;

  /**
   * Disables action buttons while checks are running.
   */
  export let checksInProgress = false;

  /**
   * Shows optional metadata about the latest checklist verification run.
   */
  export let checksMeta = '';

  /**
   * Maps checklist item states to shadcn badge variants.
   */
  function badgeVariantForState(state: SetupChecklistItem['state']): 'default' | 'secondary' | 'outline' {
    if (state === 'ok') {
      return 'default';
    }

    if (state === 'warn') {
      return 'secondary';
    }

    return 'outline';
  }
</script>

<Card.Root class="bg-card/95 shadow-sm backdrop-blur-sm">
  <Card.Header class="flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div class="space-y-1">
      <Card.Title class="text-base">Setup Checklist</Card.Title>
      <Card.Description>{completedCount}/{totalCount} integrations configured</Card.Description>
      {#if checksMeta}
        <p class="text-xs text-muted-foreground">{checksMeta}</p>
      {/if}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onclick={() => dispatch('runChecks')}
        disabled={checksInProgress}
      >
        {checksInProgress ? 'Running checks...' : 'Run checks'}
      </Button>
      <Button type="button" size="sm" onclick={() => dispatch('openOnboarding')}>
        {isComplete ? 'Edit setup' : 'Finish setup'}
      </Button>
    </div>
  </Card.Header>

  <Card.Content class="pt-0">
    <ul class="space-y-2">
      {#each items as item}
        <li class="flex items-start gap-3 rounded-md border bg-card px-3 py-2">
          <span
            class={`mt-1 size-2 shrink-0 rounded-full ${item.complete ? 'bg-emerald-600' : 'bg-muted-foreground/35'}`}
            aria-hidden="true"
          ></span>
          <div class="space-y-1">
            <strong class="flex items-center gap-2 text-sm font-semibold">
              {item.label}
              <Badge variant={badgeVariantForState(item.state)}>
                {item.state === 'ok' ? 'Ready' : item.state === 'warn' ? 'Attention' : 'Pending'}
              </Badge>
            </strong>
            <p class="text-xs text-muted-foreground">{item.description}</p>
          </div>
        </li>
      {/each}
    </ul>
  </Card.Content>
</Card.Root>
