import { describe, expect, test } from 'bun:test';
import { buildSetupChecklistItems, type ChecklistInput } from './checklist';

/**
 * Creates a baseline checklist input for test overrides.
 */
function makeInput(partial: Partial<ChecklistInput> = {}): ChecklistInput {
  return {
    emailLinkCount: 1,
    emailLinksRaw: 'Fastmail|https://app.fastmail.com',
    rssFeedUrls: 'https://hnrss.org/frontpage',
    uptimeKumaStatusUrl: 'https://status.example.com/status/main',
    caldavCalendarUrl: 'https://dav.example.com/calendars/user/main/',
    obsidianVaultPath: '/home/user/notes',
    noteCount: 3,
    widgetState: {
      rss: 'ok',
      status: 'ok',
      agenda: 'ok',
      todos: 'ok'
    },
    ...partial
  };
}

describe('buildSetupChecklistItems', () => {
  test('returns all rows as ready when inputs are healthy', () => {
    const items = buildSetupChecklistItems(makeInput());

    expect(items.length).toBe(5);
    expect(items.every((item) => item.state === 'ok')).toBe(true);
  });

  test('marks email as warning when raw links exist but parse count is zero', () => {
    const items = buildSetupChecklistItems(
      makeInput({ emailLinkCount: 0, emailLinksRaw: 'https://mail.example.com' })
    );

    const email = items.find((item) => item.id === 'email');
    expect(email?.state).toBe('warn');
    expect(email?.complete).toBe(false);
  });

  test('marks RSS/status as warning when configured but refresh has errors', () => {
    const items = buildSetupChecklistItems(
      makeInput({
        widgetState: {
          rss: 'error',
          status: 'error',
          agenda: 'ok',
          todos: 'ok'
        }
      })
    );

    const rss = items.find((item) => item.id === 'rss');
    const status = items.find((item) => item.id === 'status');
    expect(rss?.state).toBe('warn');
    expect(status?.state).toBe('warn');
  });

  test('marks CalDAV as pending without calendar URL', () => {
    const items = buildSetupChecklistItems(makeInput({ caldavCalendarUrl: '' }));

    const caldav = items.find((item) => item.id === 'caldav');
    expect(caldav?.state).toBe('todo');
    expect(caldav?.complete).toBe(false);
  });

  test('marks notes as warning when vault configured but no notes found', () => {
    const items = buildSetupChecklistItems(makeInput({ noteCount: 0 }));

    const notes = items.find((item) => item.id === 'notes');
    expect(notes?.state).toBe('warn');
    expect(notes?.complete).toBe(false);
  });
});
