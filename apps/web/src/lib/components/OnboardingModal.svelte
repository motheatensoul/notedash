<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    getProviderHint,
    type OnboardingDraft,
    type OnboardingValidationKey,
    validateOnboardingDraft
  } from '$lib/onboarding/validation';

  /**
   * Controls whether the onboarding dialog is visible.
   */
  export let open = false;

  /**
   * Holds the editable onboarding draft state.
   */
  export let draft: OnboardingDraft;

  /**
   * Displays non-blocking onboarding status text.
   */
  export let statusMessage = '';

  /**
   * Tracks field-level validation errors for onboarding inputs.
   */
  let validationErrors: Partial<Record<OnboardingValidationKey, string>> = {};

  /**
   * Indicates whether the form currently passes client-side validation.
   */
  let formIsValid = true;

  /**
   * Provides provider-specific setup guidance.
   */
  let providerHint = '';
  let selectedEmailProviderLabel = '';

  type EmailProviderPreset = OnboardingDraft['emailProviderPreset'];

  const emailProviderOptions: ReadonlyArray<{ value: EmailProviderPreset; label: string }> = [
    { value: 'fastmail', label: 'Fastmail' },
    { value: 'gmail', label: 'Gmail' },
    { value: 'outlook', label: 'Outlook' },
    { value: 'protonmail', label: 'Proton Mail' },
    { value: 'custom', label: 'Custom URL' }
  ];

  $: providerHint = getProviderHint(draft.emailProviderPreset);
  $: validationErrors = validateOnboardingDraft(draft);
  $: formIsValid = Object.keys(validationErrors).length === 0;
  $: selectedEmailProviderLabel = getEmailProviderLabel(draft.emailProviderPreset);

  const dispatch = createEventDispatcher<{
    save: { draft: OnboardingDraft };
    dismiss: undefined;
  }>();

  /**
   * Returns the user-facing label for the selected email provider preset.
   */
  function getEmailProviderLabel(preset: EmailProviderPreset): string {
    const option = emailProviderOptions.find((candidate) => candidate.value === preset);
    return option?.label ?? 'Select provider';
  }

  /**
   * Emits a save event for onboarding completion.
   */
  function handleSave(): void {
    if (!formIsValid) {
      return;
    }

    dispatch('save', { draft });
  }

  /**
   * Emits a dismiss event when user skips onboarding.
   */
  function handleDismiss(): void {
    dispatch('dismiss');
  }
</script>

<Dialog.Root open={open}>
  <Dialog.Content
    class="w-[min(760px,calc(100vw-2rem))] max-h-[88vh] overflow-y-auto p-0 sm:rounded-2xl"
    showCloseButton={false}
  >
    <div class="space-y-5 p-5 sm:space-y-6 sm:p-7">
      <Dialog.Header class="space-y-1 text-left">
        <Dialog.Title class="text-2xl tracking-tight">Welcome to Notedash</Dialog.Title>
        <Dialog.Description class="text-sm text-muted-foreground">
          Configure your key sources once so your dashboard loads with useful data immediately.
        </Dialog.Description>
      </Dialog.Header>

      <form class="space-y-4" on:submit|preventDefault={handleSave}>
        <div class="space-y-2">
          <Label for="onboarding-provider">Primary email provider</Label>
          <Select.Root type="single" bind:value={draft.emailProviderPreset}>
            <Select.Trigger id="onboarding-provider" class="w-full bg-background">
              {selectedEmailProviderLabel}
            </Select.Trigger>
            <Select.Content>
              {#each emailProviderOptions as option (option.value)}
                <Select.Item value={option.value} label={option.label} />
              {/each}
            </Select.Content>
          </Select.Root>
          <p class="text-xs text-muted-foreground">{providerHint}</p>
        </div>

        {#if draft.emailProviderPreset === 'custom'}
          <div class="space-y-2">
            <Label for="onboarding-custom-email-url">Custom inbox URL</Label>
            <Input
              id="onboarding-custom-email-url"
              type="url"
              bind:value={draft.customEmailUrl}
              placeholder="https://mail.example.com"
            />
            {#if validationErrors.customEmailUrl}
              <p class="text-xs leading-relaxed text-destructive">{validationErrors.customEmailUrl}</p>
            {/if}
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="onboarding-additional-email-links">Additional inbox links (`Label|URL,Label|URL`)</Label>
          <Input
            id="onboarding-additional-email-links"
            type="text"
            bind:value={draft.additionalEmailLinks}
            placeholder="Work Mail|https://mail.example.com"
          />
          {#if validationErrors.additionalEmailLinks}
            <p class="text-xs leading-relaxed text-destructive">{validationErrors.additionalEmailLinks}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="onboarding-rss-feed-urls">RSS sources (comma-separated)</Label>
          <Textarea
            id="onboarding-rss-feed-urls"
            rows={3}
            bind:value={draft.rssFeedUrls}
            placeholder="https://hnrss.org/frontpage,https://planet.svelte.dev/rss.xml"
          />
          {#if validationErrors.rssFeedUrls}
            <p class="text-xs leading-relaxed text-destructive">{validationErrors.rssFeedUrls}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="onboarding-uptime-kuma-url">Uptime Kuma status URL</Label>
          <Input
            id="onboarding-uptime-kuma-url"
            type="url"
            bind:value={draft.uptimeKumaStatusUrl}
            placeholder="https://status.example.com/status/main"
          />
          {#if validationErrors.uptimeKumaStatusUrl}
            <p class="text-xs leading-relaxed text-destructive">{validationErrors.uptimeKumaStatusUrl}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="onboarding-caldav-calendar-url">CalDAV calendar URL</Label>
          <Input
            id="onboarding-caldav-calendar-url"
            type="url"
            bind:value={draft.caldavCalendarUrl}
            placeholder="https://dav.example.com/calendars/user/main/"
          />
          {#if validationErrors.caldavCalendarUrl}
            <p class="text-xs leading-relaxed text-destructive">{validationErrors.caldavCalendarUrl}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="onboarding-caldav-todo-url">CalDAV todo URL (optional)</Label>
          <Input
            id="onboarding-caldav-todo-url"
            type="url"
            bind:value={draft.caldavTodoUrl}
            placeholder="https://dav.example.com/calendars/user/tasks/"
          />
          {#if validationErrors.caldavTodoUrl}
            <p class="text-xs leading-relaxed text-destructive">{validationErrors.caldavTodoUrl}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="onboarding-obsidian-vault-path">Obsidian vault path (desktop)</Label>
          <Input
            id="onboarding-obsidian-vault-path"
            type="text"
            bind:value={draft.obsidianVaultPath}
            placeholder="/home/you/notes"
          />
          <p class="text-xs text-muted-foreground">
            Used by desktop note indexing; browser mode ignores this value.
          </p>
        </div>

        <Dialog.Footer class="gap-2 border-t pt-4">
          <Button type="submit" disabled={!formIsValid}>Save Setup</Button>
          <Button variant="secondary" type="button" onclick={handleDismiss}>Skip for now</Button>
        </Dialog.Footer>

        {#if statusMessage}
          <p class="text-xs text-muted-foreground" aria-live="polite">{statusMessage}</p>
        {/if}
      </form>
    </div>
  </Dialog.Content>
</Dialog.Root>
