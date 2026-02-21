/**
 * Defines persisted user profile preferences for onboarding-driven integrations.
 */
export interface UserProfileSettings {
  onboardingCompleted: boolean;
  emailLinksRaw: string;
  caldavCalendarUrl: string;
  caldavTodoUrl: string;
  obsidianVaultPath: string;
}

/**
 * Defines the local storage key for user profile settings.
 */
export const USER_PROFILE_SETTINGS_STORAGE_KEY = 'notedash:user-profile:v1';

/**
 * Creates default user profile settings from public environment values.
 */
export function userProfileDefaultsFromPublicEnv(
  publicEnv: Record<string, string | undefined>
): UserProfileSettings {
  return {
    onboardingCompleted: false,
    emailLinksRaw: (publicEnv.PUBLIC_EMAIL_LINKS ?? '').trim(),
    caldavCalendarUrl: (publicEnv.PUBLIC_CALDAV_CALENDAR_URL ?? '').trim(),
    caldavTodoUrl: (publicEnv.PUBLIC_CALDAV_TODO_URL ?? '').trim(),
    obsidianVaultPath: (publicEnv.PUBLIC_OBSIDIAN_VAULT_PATH ?? '').trim()
  };
}

/**
 * Loads user profile settings from local storage with default fallback.
 */
export function loadUserProfileSettings(defaults: UserProfileSettings): UserProfileSettings {
  if (typeof window === 'undefined') {
    return defaults;
  }

  const raw = window.localStorage.getItem(USER_PROFILE_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserProfileSettings>;
    return sanitizeUserProfileSettings(
      {
        onboardingCompleted: parsed.onboardingCompleted ?? defaults.onboardingCompleted,
        emailLinksRaw: parsed.emailLinksRaw ?? defaults.emailLinksRaw,
        caldavCalendarUrl: parsed.caldavCalendarUrl ?? defaults.caldavCalendarUrl,
        caldavTodoUrl: parsed.caldavTodoUrl ?? defaults.caldavTodoUrl,
        obsidianVaultPath: parsed.obsidianVaultPath ?? defaults.obsidianVaultPath
      },
      defaults
    );
  } catch {
    return defaults;
  }
}

/**
 * Persists user profile settings to local storage.
 */
export function saveUserProfileSettings(settings: UserProfileSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(USER_PROFILE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Sanitizes user profile settings values.
 */
export function sanitizeUserProfileSettings(
  value: UserProfileSettings,
  fallback: UserProfileSettings = userProfileDefaultsFromPublicEnv({})
): UserProfileSettings {
  return {
    onboardingCompleted:
      typeof value.onboardingCompleted === 'boolean'
        ? value.onboardingCompleted
        : fallback.onboardingCompleted,
    emailLinksRaw: value.emailLinksRaw.trim(),
    caldavCalendarUrl: value.caldavCalendarUrl.trim(),
    caldavTodoUrl: value.caldavTodoUrl.trim(),
    obsidianVaultPath: value.obsidianVaultPath.trim()
  };
}
