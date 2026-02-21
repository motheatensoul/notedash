import type { OnboardingDraft } from '$lib/onboarding/validation';

/**
 * Defines source values used to build an onboarding draft.
 */
export interface OnboardingDraftSource {
  emailLinksRaw: string;
  rssFeedUrls: string;
  uptimeKumaStatusUrl: string;
  caldavCalendarUrl: string;
  caldavTodoUrl: string;
  obsidianVaultPath: string;
}

/**
 * Builds an onboarding draft from persisted profile and runtime values.
 */
export function buildOnboardingDraftFromSource(source: OnboardingDraftSource): OnboardingDraft {
  return {
    emailProviderPreset: inferEmailPreset(source.emailLinksRaw),
    customEmailUrl: inferCustomEmailUrl(source.emailLinksRaw),
    additionalEmailLinks: inferAdditionalEmailLinks(source.emailLinksRaw),
    rssFeedUrls: source.rssFeedUrls,
    uptimeKumaStatusUrl: source.uptimeKumaStatusUrl,
    caldavCalendarUrl: source.caldavCalendarUrl,
    caldavTodoUrl: source.caldavTodoUrl,
    obsidianVaultPath: source.obsidianVaultPath
  };
}

/**
 * Resolves provider preset from persisted email link configuration.
 */
export function inferEmailPreset(rawLinks: string): OnboardingDraft['emailProviderPreset'] {
  const lower = rawLinks.toLowerCase();
  if (lower.includes('fastmail.com')) {
    return 'fastmail';
  }
  if (lower.includes('mail.google.com')) {
    return 'gmail';
  }
  if (lower.includes('outlook.live.com') || lower.includes('outlook.office.com')) {
    return 'outlook';
  }
  if (lower.includes('mail.proton.me') || lower.includes('protonmail')) {
    return 'protonmail';
  }

  return 'custom';
}

/**
 * Extracts a custom URL candidate from the first configured email link.
 */
export function inferCustomEmailUrl(rawLinks: string): string {
  const first = rawLinks.split(',').map((value) => value.trim()).find(Boolean);
  if (!first) {
    return '';
  }

  const parts = first.split('|').map((value) => value.trim());
  return parts.length > 1 ? parts[1] : '';
}

/**
 * Extracts additional links beyond the first configured inbox entry.
 */
export function inferAdditionalEmailLinks(rawLinks: string): string {
  const entries = rawLinks
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (entries.length <= 1) {
    return '';
  }

  return entries.slice(1).join(',');
}

/**
 * Composes persisted email links from onboarding form values.
 */
export function composeEmailLinksRaw(draft: OnboardingDraft): string {
  const preset: Record<Exclude<OnboardingDraft['emailProviderPreset'], 'custom'>, string> = {
    fastmail: 'Fastmail|https://app.fastmail.com',
    gmail: 'Gmail|https://mail.google.com',
    outlook: 'Outlook|https://outlook.live.com',
    protonmail: 'Proton Mail|https://mail.proton.me'
  };

  const primary =
    draft.emailProviderPreset === 'custom'
      ? draft.customEmailUrl.trim()
        ? `Inbox|${draft.customEmailUrl.trim()}`
        : ''
      : preset[draft.emailProviderPreset];

  return [primary, draft.additionalEmailLinks.trim()].filter(Boolean).join(',');
}
