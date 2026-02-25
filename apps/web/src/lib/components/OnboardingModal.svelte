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

  /**
   * Tracks which onboarding step is currently visible.
   */
  let activeStepIndex = 0;

  /**
   * Tracks previous open state so step progress resets only when reopened.
   */
  let wasOpen = open;

  type EmailProviderPreset = OnboardingDraft['emailProviderPreset'];

  type OnboardingStepId = 'email' | 'feeds' | 'calendar' | 'notes';

  interface OnboardingStep {
    id: OnboardingStepId;
    shortTitle: string;
    title: string;
    description: string;
  }

  const onboardingSteps: ReadonlyArray<OnboardingStep> = [
    {
      id: 'email',
      shortTitle: 'Email',
      title: 'Email setup',
      description: 'Choose your inbox provider and optional extra mailbox links.'
    },
    {
      id: 'feeds',
      shortTitle: 'Feeds',
      title: 'Feeds and status',
      description: 'Set RSS sources and optionally connect your Uptime Kuma status page.'
    },
    {
      id: 'calendar',
      shortTitle: 'Calendar',
      title: 'Calendar sync',
      description: 'Add CalDAV URLs for events and optional task list sync.'
    },
    {
      id: 'notes',
      shortTitle: 'Notes',
      title: 'Notes source',
      description: 'Set your Obsidian vault path for desktop note indexing.'
    }
  ];

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
  $: activeStep = onboardingSteps[activeStepIndex];
  $: activeStepHasErrors = doesStepHaveErrors(activeStep.id, validationErrors);
  $: onFinalStep = activeStepIndex === onboardingSteps.length - 1;
  $: canMoveBack = activeStepIndex > 0;
  $: canMoveForward = !activeStepHasErrors;
  $: nextStep = onboardingSteps[activeStepIndex + 1] ?? null;
  $: if (open && !wasOpen) {
    activeStepIndex = 0;
  }
  $: wasOpen = open;

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
    if (!onFinalStep) {
      if (canMoveForward) {
        goToNextStep();
      }
      return;
    }

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

  /**
   * Advances onboarding by one step when current inputs are valid.
   */
  function goToNextStep(): void {
    if (!canMoveForward || onFinalStep) {
      return;
    }

    activeStepIndex += 1;
  }

  /**
   * Returns to the previous onboarding step.
   */
  function goToPreviousStep(): void {
    if (!canMoveBack) {
      return;
    }

    activeStepIndex -= 1;
  }

  /**
   * Returns whether a user can navigate directly to a specific step.
   */
  function canNavigateToStep(targetStepIndex: number): boolean {
    if (targetStepIndex < 0 || targetStepIndex >= onboardingSteps.length) {
      return false;
    }

    if (targetStepIndex <= activeStepIndex) {
      return true;
    }

    for (let index = 0; index < targetStepIndex; index += 1) {
      if (doesStepHaveErrors(onboardingSteps[index].id, validationErrors)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Moves onboarding to a selected step when navigation rules allow it.
   */
  function goToStep(targetStepIndex: number): void {
    if (!canNavigateToStep(targetStepIndex)) {
      return;
    }

    activeStepIndex = targetStepIndex;
  }

  /**
   * Builds step button classes based on progress and navigation availability.
   */
  function getStepButtonClass(stepIndex: number): string {
    const isCompletedOrActive = stepIndex <= activeStepIndex;
    const isLocked = !canNavigateToStep(stepIndex);

    return [
      'h-auto min-w-0 shrink items-start justify-start whitespace-normal rounded-lg border px-2 py-2 text-left leading-snug',
      isCompletedOrActive ? 'border-primary bg-background' : '',
      isLocked ? 'opacity-60' : ''
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Returns validation keys that belong to each onboarding step.
   */
  function getStepValidationKeys(stepId: OnboardingStepId): ReadonlyArray<OnboardingValidationKey> {
    if (stepId === 'email') {
      return ['customEmailUrl', 'additionalEmailLinks'];
    }

    if (stepId === 'feeds') {
      return ['rssFeedUrls', 'uptimeKumaStatusUrl'];
    }

    if (stepId === 'calendar') {
      return ['caldavCalendarUrl', 'caldavTodoUrl'];
    }

    return [];
  }

  /**
   * Returns whether the active step contains validation errors.
   */
  function doesStepHaveErrors(
    stepId: OnboardingStepId,
    errors: Partial<Record<OnboardingValidationKey, string>>
  ): boolean {
    return getStepValidationKeys(stepId).some((key) => Boolean(errors[key]));
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

      <form class="space-y-3" on:submit|preventDefault={handleSave}>
        <div class="space-y-2.5 rounded-xl border bg-muted/25 px-3 py-3">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Step {activeStepIndex + 1} of {onboardingSteps.length}
            </p>
            <span class="text-[11px] text-muted-foreground/70">Current section</span>
          </div>
          <p class="text-sm font-semibold leading-snug text-foreground">{activeStep.title}</p>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {#each onboardingSteps as step, index (step.id)}
              <Button
                type="button"
                variant="ghost"
                class={getStepButtonClass(index)}
                aria-current={index === activeStepIndex ? 'step' : undefined}
                onclick={() => goToStep(index)}
                disabled={!canNavigateToStep(index)}
              >
                <span class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold">
                  {index + 1}
                </span>
                <span class="min-w-0 text-xs font-medium leading-snug">{step.shortTitle}</span>
              </Button>
            {/each}
          </div>
          <p class="text-xs leading-relaxed text-muted-foreground/90">{activeStep.description}</p>
        </div>

        {#if activeStep.id === 'email'}
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
            <Label for="onboarding-additional-email-links"
              >Additional inbox links (`Label|URL,Label|URL`)</Label
            >
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
        {:else if activeStep.id === 'feeds'}
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
        {:else if activeStep.id === 'calendar'}
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
        {:else}
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
        {/if}

        <Dialog.Footer class="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="secondary" type="button" onclick={handleDismiss}>Skip for now</Button>

          <div class="flex w-full gap-2 sm:w-auto sm:justify-end">
            <Button type="button" variant="outline" onclick={goToPreviousStep} disabled={!canMoveBack}>Back</Button>

            {#if onFinalStep}
              <Button type="submit" disabled={!formIsValid}>Save Setup</Button>
            {:else}
              <Button type="button" onclick={goToNextStep} disabled={!canMoveForward}>
                Next: {nextStep?.shortTitle ?? 'Continue'}
              </Button>
            {/if}
          </div>
        </Dialog.Footer>

        {#if statusMessage}
          <p class="text-xs text-muted-foreground" aria-live="polite">{statusMessage}</p>
        {/if}
      </form>
    </div>
  </Dialog.Content>
</Dialog.Root>
