import { describe, expect, test } from 'bun:test';
import {
  defaultLayoutEntry,
  mergeLayoutWithDefaults,
  type LayoutSettings,
  type WidgetLayoutEntry
} from './layout-settings';

/**
 * Builds a minimal WidgetLayoutEntry for test use.
 */
function entry(kind: string, size: WidgetLayoutEntry['size'], order: number, hidden = false): WidgetLayoutEntry {
  return { kind, size, order, hidden };
}

describe('defaultLayoutEntry', () => {
  test('creates entry with hidden: false', () => {
    const result = defaultLayoutEntry('agenda', 'large', 0);
    expect(result).toEqual({ kind: 'agenda', size: 'large', order: 0, hidden: false });
  });
});

describe('mergeLayoutWithDefaults', () => {
  const defaults: WidgetLayoutEntry[] = [
    entry('agenda', 'large', 0),
    entry('todos', 'medium', 1),
    entry('notes', 'medium', 2),
    entry('rss', 'large', 3),
    entry('status', 'small', 4),
    entry('email-links', 'small', 5)
  ];

  test('returns defaults when saved is empty', () => {
    const saved: LayoutSettings = { widgets: [] };
    const result = mergeLayoutWithDefaults(saved, defaults);
    expect(result.map((e) => e.kind)).toEqual(['agenda', 'todos', 'notes', 'rss', 'status', 'email-links']);
    expect(result[0].size).toBe('large');
  });

  test('preserves saved size and order overrides for known kinds', () => {
    const saved: LayoutSettings = {
      widgets: [
        entry('agenda', 'full', 10),
        entry('rss', 'small', 20)
      ]
    };

    const result = mergeLayoutWithDefaults(saved, defaults);
    const agendaEntry = result.find((e) => e.kind === 'agenda');
    expect(agendaEntry?.size).toBe('full');
    expect(agendaEntry?.order).toBe(10);

    const rssEntry = result.find((e) => e.kind === 'rss');
    expect(rssEntry?.size).toBe('small');
  });

  test('inserts missing defaults for kinds absent from saved', () => {
    const saved: LayoutSettings = {
      widgets: [entry('agenda', 'large', 0)]
    };

    const result = mergeLayoutWithDefaults(saved, defaults);
    const kinds = result.map((e) => e.kind);
    expect(kinds).toContain('todos');
    expect(kinds).toContain('notes');
    expect(kinds).toContain('rss');
    expect(kinds).toContain('email-links');
  });

  test('drops unknown kinds not present in defaults', () => {
    const saved: LayoutSettings = {
      widgets: [entry('unknown-widget', 'medium', 99)]
    };

    const result = mergeLayoutWithDefaults(saved, defaults);
    expect(result.find((e) => e.kind === 'unknown-widget')).toBeUndefined();
  });

  test('sorts merged entries by order ascending', () => {
    const saved: LayoutSettings = {
      widgets: [
        entry('rss', 'large', 100),
        entry('todos', 'medium', 0),
        entry('agenda', 'large', 50)
      ]
    };

    const result = mergeLayoutWithDefaults(saved, defaults);
    const orders = result.map((e) => e.order);
    // Saved entries have higher orders; unsaved entries get default order values
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  test('preserves hidden flag from saved entries', () => {
    const saved: LayoutSettings = {
      widgets: [entry('notes', 'medium', 2, true)]
    };

    const result = mergeLayoutWithDefaults(saved, defaults);
    expect(result.find((e) => e.kind === 'notes')?.hidden).toBe(true);
  });
});
