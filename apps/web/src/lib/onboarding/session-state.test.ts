import { describe, expect, test } from 'bun:test';
import {
  clearOnboardingDismissed,
  markOnboardingDismissed,
  ONBOARDING_DISMISSED_SESSION_KEY,
  shouldOpenOnboarding,
  type SessionStorageLike
} from './session-state';

/**
 * Creates an in-memory session storage mock for tests.
 */
function makeStorage(): SessionStorageLike {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

describe('onboarding session state helpers', () => {
  test('opens onboarding when not completed and not dismissed', () => {
    const storage = makeStorage();
    expect(shouldOpenOnboarding(false, storage)).toBe(true);
  });

  test('does not open onboarding when profile already completed', () => {
    const storage = makeStorage();
    expect(shouldOpenOnboarding(true, storage)).toBe(false);
  });

  test('respects dismiss and clear helpers', () => {
    const storage = makeStorage();

    markOnboardingDismissed(storage);
    expect(storage.getItem(ONBOARDING_DISMISSED_SESSION_KEY)).toBe('1');
    expect(shouldOpenOnboarding(false, storage)).toBe(false);

    clearOnboardingDismissed(storage);
    expect(storage.getItem(ONBOARDING_DISMISSED_SESSION_KEY)).toBeNull();
    expect(shouldOpenOnboarding(false, storage)).toBe(true);
  });
});
