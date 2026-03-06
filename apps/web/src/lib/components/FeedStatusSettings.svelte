<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
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

<Card.Root class="bg-card/95 shadow-sm backdrop-blur-sm">
  <Card.Header class="gap-1">
    <Card.Title class="text-base">Feed and Status Settings</Card.Title>
    <Card.Description>Adjust refresh windows and integration sources.</Card.Description>
  </Card.Header>

  <Card.Content>
    <form class="space-y-4" on:submit|preventDefault={handleSave}>
      <div class="space-y-2">
        <Label for="settings-rss-feed-urls">RSS sources (comma-separated)</Label>
        <Textarea
          id="settings-rss-feed-urls"
          rows={3}
          bind:value={draft.rssFeedUrls}
          placeholder="https://hnrss.org/frontpage,https://planet.svelte.dev/rss.xml"
        />
      </div>

      <div class="space-y-2">
        <Label for="settings-uptime-kuma-url">Uptime Kuma status URL</Label>
        <Input
          id="settings-uptime-kuma-url"
          type="url"
          bind:value={draft.uptimeKumaStatusUrl}
          placeholder="https://status.example.com/status/main"
        />
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <div class="space-y-2">
          <Label for="settings-refresh-seconds">Refresh interval (seconds)</Label>
          <Input id="settings-refresh-seconds" type="number" min="15" step="1" bind:value={draft.refreshSeconds} />
        </div>

        <div class="space-y-2">
          <Label for="settings-rss-cache-ttl">RSS cache TTL (seconds)</Label>
          <Input id="settings-rss-cache-ttl" type="number" min="30" step="1" bind:value={draft.rssCacheTtlSeconds} />
        </div>

        <div class="space-y-2">
          <Label for="settings-status-cache-ttl">Status cache TTL (seconds)</Label>
          <Input
            id="settings-status-cache-ttl"
            type="number"
            min="15"
            step="1"
            bind:value={draft.statusCacheTtlSeconds}
          />
        </div>
      </div>

      <Card.Footer class="flex-wrap gap-2 border-t px-0 pt-4">
        <Button class="w-fit" type="submit">Save and Apply</Button>
        <Button class="w-fit" variant="secondary" type="button" onclick={handleReset}>Reset Draft</Button>
        <Button class="w-fit" variant="destructive" type="button" onclick={handleResetSetup}
          >Reset Setup</Button
        >
      </Card.Footer>

      {#if statusMessage}
        <p class="text-xs text-muted-foreground" aria-live="polite">{statusMessage}</p>
      {/if}
    </form>
  </Card.Content>
</Card.Root>
