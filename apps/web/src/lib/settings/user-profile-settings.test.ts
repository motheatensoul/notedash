import { describe, expect, test } from 'bun:test';
import {
  sanitizeUserProfileSettings,
  userProfileDefaultsFromPublicEnv,
  type UserProfileSettings
} from './user-profile-settings';

/**
 * Creates a valid user profile settings object for test overrides.
 */
function makeProfile(partial: Partial<UserProfileSettings> = {}): UserProfileSettings {
  return {
    onboardingCompleted: true,
    emailLinksRaw: 'Fastmail|https://app.fastmail.com',
    caldavCalendarUrl: 'https://dav.example.com/calendars/user/main/',
    caldavTodoUrl: 'https://dav.example.com/calendars/user/tasks/',
    obsidianVaultPath: '/home/user/notes',
    ...partial
  };
}

describe('userProfileDefaultsFromPublicEnv', () => {
  test('maps public env values into defaults', () => {
    const defaults = userProfileDefaultsFromPublicEnv({
      PUBLIC_EMAIL_LINKS: 'Mail|https://mail.example.com',
      PUBLIC_CALDAV_CALENDAR_URL: 'https://dav.example.com/main/',
      PUBLIC_CALDAV_TODO_URL: 'https://dav.example.com/tasks/',
      PUBLIC_OBSIDIAN_VAULT_PATH: '/vault/main'
    });

    expect(defaults.onboardingCompleted).toBe(false);
    expect(defaults.emailLinksRaw).toContain('mail.example.com');
    expect(defaults.caldavCalendarUrl).toBe('https://dav.example.com/main/');
    expect(defaults.caldavTodoUrl).toBe('https://dav.example.com/tasks/');
    expect(defaults.obsidianVaultPath).toBe('/vault/main');
  });
});

describe('sanitizeUserProfileSettings', () => {
  test('trims string fields', () => {
    const sanitized = sanitizeUserProfileSettings(
      makeProfile({
        emailLinksRaw: '  Mail|https://mail.example.com  ',
        caldavCalendarUrl: '  https://dav.example.com/main/  ',
        caldavTodoUrl: '  https://dav.example.com/tasks/  ',
        obsidianVaultPath: '  /home/user/notes  '
      })
    );

    expect(sanitized.emailLinksRaw).toBe('Mail|https://mail.example.com');
    expect(sanitized.caldavCalendarUrl).toBe('https://dav.example.com/main/');
    expect(sanitized.caldavTodoUrl).toBe('https://dav.example.com/tasks/');
    expect(sanitized.obsidianVaultPath).toBe('/home/user/notes');
  });

  test('falls back when onboardingCompleted is not boolean', () => {
    const fallback = makeProfile({ onboardingCompleted: false });
    const malformed = {
      ...makeProfile(),
      onboardingCompleted: 'yes'
    } as unknown as UserProfileSettings;

    const sanitized = sanitizeUserProfileSettings(malformed, fallback);
    expect(sanitized.onboardingCompleted).toBe(false);
  });
});
