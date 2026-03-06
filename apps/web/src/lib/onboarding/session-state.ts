/**
 * Defines the session-storage key for onboarding dismissal state.
 */
export const ONBOARDING_DISMISSED_SESSION_KEY = 'notedash:onboarding:dismissed';

/**
 * Defines a minimal storage contract for onboarding session helpers.
 */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Returns whether onboarding should open for the current session.
 */
export function shouldOpenOnboarding(
  onboardingCompleted: boolean,
  sessionStorageLike?: SessionStorageLike
): boolean {
  if (onboardingCompleted) {
    return false;
  }

  if (!sessionStorageLike) {
    return true;
  }

  return sessionStorageLike.getItem(ONBOARDING_DISMISSED_SESSION_KEY) !== '1';
}

/**
 * Marks onboarding as dismissed for the active browser session.
 */
export function markOnboardingDismissed(sessionStorageLike?: SessionStorageLike): void {
  sessionStorageLike?.setItem(ONBOARDING_DISMISSED_SESSION_KEY, '1');
}

/**
 * Clears onboarding dismissal state for the active browser session.
 */
export function clearOnboardingDismissed(sessionStorageLike?: SessionStorageLike): void {
  sessionStorageLike?.removeItem(ONBOARDING_DISMISSED_SESSION_KEY);
}
