<script lang="ts">
  import { createEventDispatcher } from 'svelte';
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

  $: providerHint = getProviderHint(draft.emailProviderPreset);
  $: validationErrors = validateOnboardingDraft(draft);
  $: formIsValid = Object.keys(validationErrors).length === 0;

  const dispatch = createEventDispatcher<{
    save: { draft: OnboardingDraft };
    dismiss: undefined;
  }>();

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

{#if open}
  <div class="backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <h2 id="onboarding-title">Welcome to Notedash</h2>
      <p>
        Configure your key sources once so your dashboard loads with useful data immediately.
      </p>

      <form class="form" on:submit|preventDefault={handleSave}>
        <label>
          Primary email provider
          <select bind:value={draft.emailProviderPreset}>
            <option value="fastmail">Fastmail</option>
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
            <option value="protonmail">Proton Mail</option>
            <option value="custom">Custom URL</option>
          </select>
        </label>
        <p class="hint">{providerHint}</p>

        {#if draft.emailProviderPreset === 'custom'}
          <label>
            Custom inbox URL
            <input type="url" bind:value={draft.customEmailUrl} placeholder="https://mail.example.com" />
          </label>
          {#if validationErrors.customEmailUrl}
            <p class="error">{validationErrors.customEmailUrl}</p>
          {/if}
        {/if}

        <label>
          Additional inbox links (`Label|URL,Label|URL`)
          <input
            type="text"
            bind:value={draft.additionalEmailLinks}
            placeholder="Work Mail|https://mail.example.com"
          />
        </label>
        {#if validationErrors.additionalEmailLinks}
          <p class="error">{validationErrors.additionalEmailLinks}</p>
        {/if}

        <label>
          RSS sources (comma-separated)
          <textarea
            rows="3"
            bind:value={draft.rssFeedUrls}
            placeholder="https://hnrss.org/frontpage,https://planet.svelte.dev/rss.xml"
          ></textarea>
        </label>
        {#if validationErrors.rssFeedUrls}
          <p class="error">{validationErrors.rssFeedUrls}</p>
        {/if}

        <label>
          Uptime Kuma status URL
          <input
            type="url"
            bind:value={draft.uptimeKumaStatusUrl}
            placeholder="https://status.example.com/status/main"
          />
        </label>
        {#if validationErrors.uptimeKumaStatusUrl}
          <p class="error">{validationErrors.uptimeKumaStatusUrl}</p>
        {/if}

        <label>
          CalDAV calendar URL
          <input
            type="url"
            bind:value={draft.caldavCalendarUrl}
            placeholder="https://dav.example.com/calendars/user/main/"
          />
        </label>
        {#if validationErrors.caldavCalendarUrl}
          <p class="error">{validationErrors.caldavCalendarUrl}</p>
        {/if}

        <label>
          CalDAV todo URL (optional)
          <input
            type="url"
            bind:value={draft.caldavTodoUrl}
            placeholder="https://dav.example.com/calendars/user/tasks/"
          />
        </label>
        {#if validationErrors.caldavTodoUrl}
          <p class="error">{validationErrors.caldavTodoUrl}</p>
        {/if}

        <div class="actions">
          <button class="btn" type="submit" disabled={!formIsValid}>Save Setup</button>
          <button class="btn secondary" type="button" on:click={handleDismiss}>Skip for now</button>
        </div>

        {#if statusMessage}
          <p class="status">{statusMessage}</p>
        {/if}
      </form>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(8, 15, 22, 0.58);
    display: grid;
    place-items: center;
    z-index: 80;
    padding: 1rem;
  }

  .modal {
    width: min(760px, 100%);
    max-height: 88vh;
    overflow: auto;
    border-radius: 20px;
    border: 1px solid var(--nd-border);
    background: var(--nd-surface-strong);
    box-shadow: 0 24px 60px rgba(6, 14, 18, 0.35);
    padding: 1rem;
    display: grid;
    gap: 0.75rem;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  p {
    margin: 0;
    color: var(--nd-text-muted);
  }

  .form {
    display: grid;
    gap: 0.66rem;
  }

  .hint {
    margin: -0.2rem 0 0;
    font-size: 0.8rem;
  }

  .error {
    margin: -0.2rem 0 0;
    color: var(--nd-danger);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  label {
    display: grid;
    gap: 0.3rem;
    font-size: 0.86rem;
    color: var(--nd-text-muted);
    font-weight: 650;
  }

  input,
  select,
  textarea {
    width: 100%;
    border-radius: var(--nd-radius-md);
    border: 1px solid var(--nd-border);
    background: var(--nd-surface-strong);
    color: var(--nd-text);
    padding: 0.5rem 0.6rem;
    font: inherit;
  }

  .actions {
    display: flex;
    gap: 0.55rem;
  }

  .btn {
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

  .btn.secondary {
    background: transparent;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status {
    font-size: 0.82rem;
  }
</style>
