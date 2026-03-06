import { describe, expect, test } from 'bun:test';
import {
  buildOnboardingDraftFromSource,
  composeEmailLinksRaw,
  inferAdditionalEmailLinks,
  inferCustomEmailUrl,
  inferEmailPreset
} from './profile-mapping';

describe('profile mapping helpers', () => {
  test('infers known provider presets', () => {
    expect(inferEmailPreset('Fastmail|https://app.fastmail.com')).toBe('fastmail');
    expect(inferEmailPreset('Inbox|https://mail.google.com')).toBe('gmail');
  });

  test('extracts custom and additional links', () => {
    const raw = 'Inbox|https://mail.example.com,Ops|https://ops.example.com';
    expect(inferCustomEmailUrl(raw)).toBe('https://mail.example.com');
    expect(inferAdditionalEmailLinks(raw)).toBe('Ops|https://ops.example.com');
  });

  test('composes email links from onboarding draft', () => {
    const composed = composeEmailLinksRaw({
      emailProviderPreset: 'custom',
      customEmailUrl: 'https://mail.example.com',
      additionalEmailLinks: 'Ops|https://ops.example.com',
      rssFeedUrls: '',
      uptimeKumaStatusUrl: '',
      caldavCalendarUrl: '',
      caldavTodoUrl: '',
      obsidianVaultPath: ''
    });

    expect(composed).toBe('Inbox|https://mail.example.com,Ops|https://ops.example.com');
  });

  test('builds onboarding draft from source values', () => {
    const draft = buildOnboardingDraftFromSource({
      emailLinksRaw: 'Fastmail|https://app.fastmail.com,Ops|https://ops.example.com',
      rssFeedUrls: 'https://hnrss.org/frontpage',
      uptimeKumaStatusUrl: 'https://status.example.com/status/main',
      caldavCalendarUrl: 'https://dav.example.com/main/',
      caldavTodoUrl: 'https://dav.example.com/tasks/',
      obsidianVaultPath: '/home/user/notes'
    });

    expect(draft.emailProviderPreset).toBe('fastmail');
    expect(draft.additionalEmailLinks).toBe('Ops|https://ops.example.com');
    expect(draft.obsidianVaultPath).toBe('/home/user/notes');
  });
});
