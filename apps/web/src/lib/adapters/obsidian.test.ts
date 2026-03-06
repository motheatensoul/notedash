import { describe, expect, test } from 'bun:test';
import { fetchRecentNotes, fetchRecentNotesDetailed } from './obsidian';

describe('fetchRecentNotesDetailed', () => {
  test('returns empty result when vault path is missing', async () => {
    const result = await fetchRecentNotesDetailed({ vaultPath: '' });

    expect(result.notes).toHaveLength(0);
    expect(result.errorDetail).toBeUndefined();
    expect(result.warningDetail).toBeUndefined();
  });

  test('returns non-fatal warning when desktop runtime is unavailable', async () => {
    const result = await fetchRecentNotesDetailed({ vaultPath: '/home/user/notes' });

    expect(result.notes).toHaveLength(0);
    expect(result.errorDetail).toBeUndefined();
    expect(result.warningDetail).toContain('Desktop runtime required');
  });
});

describe('fetchRecentNotes', () => {
  test('returns only note rows from detailed adapter result', async () => {
    const notes = await fetchRecentNotes({ vaultPath: '/home/user/notes' });
    expect(Array.isArray(notes)).toBe(true);
    expect(notes).toHaveLength(0);
  });
});
