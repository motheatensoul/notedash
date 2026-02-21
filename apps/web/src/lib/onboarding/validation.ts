/**
 * Defines editable onboarding form values.
 */
export interface OnboardingDraft {
  emailProviderPreset: 'fastmail' | 'gmail' | 'outlook' | 'protonmail' | 'custom';
  customEmailUrl: string;
  additionalEmailLinks: string;
  rssFeedUrls: string;
  uptimeKumaStatusUrl: string;
  caldavCalendarUrl: string;
  caldavTodoUrl: string;
  obsidianVaultPath: string;
}

/**
 * Defines validation error keys for onboarding fields.
 */
export type OnboardingValidationKey =
  | 'customEmailUrl'
  | 'additionalEmailLinks'
  | 'rssFeedUrls'
  | 'uptimeKumaStatusUrl'
  | 'caldavCalendarUrl'
  | 'caldavTodoUrl';

/**
 * Returns contextual setup guidance for each email provider preset.
 */
export function getProviderHint(preset: OnboardingDraft['emailProviderPreset']): string {
  if (preset === 'fastmail') {
    return 'Fastmail preset adds https://app.fastmail.com as your primary inbox link.';
  }

  if (preset === 'gmail') {
    return 'Gmail preset adds https://mail.google.com as your primary inbox link.';
  }

  if (preset === 'outlook') {
    return 'Outlook preset adds https://outlook.live.com as your primary inbox link.';
  }

  if (preset === 'protonmail') {
    return 'Proton Mail preset adds https://mail.proton.me as your primary inbox link.';
  }

  return 'Custom provider requires a full inbox URL including https://.';
}

/**
 * Validates onboarding fields and returns inline error messages.
 */
export function validateOnboardingDraft(
  value: OnboardingDraft
): Partial<Record<OnboardingValidationKey, string>> {
  const errors: Partial<Record<OnboardingValidationKey, string>> = {};

  if (value.emailProviderPreset === 'custom') {
    const customUrl = value.customEmailUrl.trim();
    if (!customUrl) {
      errors.customEmailUrl = 'Custom provider requires an inbox URL.';
    } else if (!isHttpUrl(customUrl)) {
      errors.customEmailUrl = 'Use a valid URL such as https://mail.example.com.';
    }
  }

  const additionalLinks = value.additionalEmailLinks
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of additionalLinks) {
    const [label, href] = entry.split('|').map((part) => part.trim());
    if (!label || !href) {
      errors.additionalEmailLinks = 'Each additional link must use Label|URL format.';
      break;
    }

    if (!isHttpUrl(href)) {
      errors.additionalEmailLinks = 'Additional link URLs must start with http:// or https://.';
      break;
    }
  }

  const rssUrls = value.rssFeedUrls
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (rssUrls.length === 0) {
    errors.rssFeedUrls = 'Add at least one RSS source URL.';
  } else if (rssUrls.some((url) => !isHttpUrl(url))) {
    errors.rssFeedUrls = 'RSS sources must be valid URLs separated by commas.';
  }

  if (value.uptimeKumaStatusUrl.trim() && !isHttpUrl(value.uptimeKumaStatusUrl.trim())) {
    errors.uptimeKumaStatusUrl = 'Uptime Kuma URL must start with http:// or https://.';
  }

  if (value.caldavCalendarUrl.trim() && !isHttpUrl(value.caldavCalendarUrl.trim())) {
    errors.caldavCalendarUrl = 'CalDAV calendar URL must start with http:// or https://.';
  }

  if (value.caldavTodoUrl.trim() && !isHttpUrl(value.caldavTodoUrl.trim())) {
    errors.caldavTodoUrl = 'CalDAV todo URL must start with http:// or https://.';
  }

  return errors;
}

/**
 * Returns whether a string is a valid HTTP(S) URL.
 */
export function isHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
