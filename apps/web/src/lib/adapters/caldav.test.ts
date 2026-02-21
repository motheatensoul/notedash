import { afterEach, describe, expect, test } from 'bun:test';
import { fetchCaldavAgendaDetailed } from './caldav';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchCaldavAgendaDetailed', () => {
  test('returns empty payload when no collection URLs are configured', async () => {
    const result = await fetchCaldavAgendaDetailed({ serverUrl: '' });

    expect(result.events.length).toBe(0);
    expect(result.todos.length).toBe(0);
    expect(result.errorDetail).toBeUndefined();
  });

  test('returns diagnostics when REPORT requests fail', async () => {
    globalThis.fetch = async () => new Response('forbidden', { status: 403 });

    const result = await fetchCaldavAgendaDetailed({
      serverUrl: 'https://dav.example.com/calendars/user/main/'
    });

    expect(result.events.length).toBe(0);
    expect(result.todos.length).toBe(0);
    expect(result.errorDetail).toContain('VEVENT query failed');
  });

  test('parses event payload when XML/DOM parser is available', async () => {
    globalThis.fetch = async (_input, init) => {
      const requestBody = String(init?.body ?? '');
      const component = requestBody.includes('name="VEVENT"') ? 'VEVENT' : 'VTODO';

      if (component === 'VTODO') {
        return new Response(
          `<?xml version="1.0" encoding="utf-8"?>
           <multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
             <response><propstat><prop><cal:calendar-data>
BEGIN:VCALENDAR
BEGIN:VTODO
UID:todo-1
SUMMARY:Task One
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR
             </cal:calendar-data></prop></propstat></response>
           </multistatus>`,
          { status: 200 }
        );
      }

      return new Response(
        `<?xml version="1.0" encoding="utf-8"?>
         <multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
           <response><propstat><prop><cal:calendar-data>
BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-1
SUMMARY:Morning Sync
DTSTART:20270101T090000Z
DTEND:20270101T093000Z
END:VEVENT
END:VCALENDAR
           </cal:calendar-data></prop></propstat></response>
         </multistatus>`,
        { status: 200 }
      );
    };

    const result = await fetchCaldavAgendaDetailed({
      serverUrl: 'https://dav.example.com/calendars/user/main/'
    });

    if (typeof DOMParser === 'undefined') {
      expect(result.errorDetail).toContain('parsing unavailable');
      return;
    }

    expect(result.errorDetail).toBeUndefined();
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    expect(result.events[0].title).toBe('Morning Sync');
    expect(result.todos.length).toBeGreaterThanOrEqual(1);
    expect(result.todos[0].title).toBe('Task One');
  });
});
