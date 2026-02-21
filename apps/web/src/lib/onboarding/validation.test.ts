import { describe, expect, test } from 'bun:test';
import {
  getProviderHint,
  isHttpUrl,
  validateOnboardingDraft,
  type OnboardingDraft
} from './validation';

/**
 * Creates a valid onboarding draft for test overrides.
 */
function makeDraft(partial: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    emailProviderPreset: 'gmail',
    customEmailUrl: '',
    additionalEmailLinks: '',
    rssFeedUrls: 'https://hnrss.org/frontpage',
    uptimeKumaStatusUrl: 'https://status.example.com/status/main',
    caldavCalendarUrl: 'https://dav.example.com/calendars/user/main/',
    caldavTodoUrl: 'https://dav.example.com/calendars/user/tasks/',
    obsidianVaultPath: '/home/user/notes',
    ...partial
  };
}

describe('isHttpUrl', () => {
  test('accepts http and https URLs', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  test('rejects invalid or unsupported schemes', () => {
    expect(isHttpUrl('mailto:user@example.com')).toBe(false);
    expect(isHttpUrl('not-a-url')).toBe(false);
  });
});

describe('validateOnboardingDraft', () => {
  test('requires at least one RSS URL', () => {
    const result = validateOnboardingDraft(makeDraft({ rssFeedUrls: '' }));
    expect(result.rssFeedUrls).toBeDefined();
  });

  test('validates custom provider URL', () => {
    const missingUrl = validateOnboardingDraft(
      makeDraft({ emailProviderPreset: 'custom', customEmailUrl: '' })
    );
    expect(missingUrl.customEmailUrl).toBeDefined();

    const invalidUrl = validateOnboardingDraft(
      makeDraft({ emailProviderPreset: 'custom', customEmailUrl: 'invalid' })
    );
    expect(invalidUrl.customEmailUrl).toBeDefined();
  });

  test('validates additional Label|URL link format', () => {
    const badFormat = validateOnboardingDraft(makeDraft({ additionalEmailLinks: 'https://mail.example.com' }));
    expect(badFormat.additionalEmailLinks).toBeDefined();

    const badUrl = validateOnboardingDraft(makeDraft({ additionalEmailLinks: 'Work|notaurl' }));
    expect(badUrl.additionalEmailLinks).toBeDefined();

    const valid = validateOnboardingDraft(
      makeDraft({ additionalEmailLinks: 'Work|https://mail.example.com,Ops|https://ops.example.com' })
    );
    expect(valid.additionalEmailLinks).toBeUndefined();
  });
});

describe('getProviderHint', () => {
  test('returns custom guidance for custom preset', () => {
    expect(getProviderHint('custom')).toContain('https://');
  });
});
