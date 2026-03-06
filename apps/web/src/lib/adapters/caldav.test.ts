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

  test('discovers Nextcloud calendar collections from base URL', async () => {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (method === 'PROPFIND') {
        const auth = new Headers(init?.headers).get('Authorization');
        expect(auth).toBe('Basic YWxpY2U6c2VjcmV0');
        expect(url).toBe('https://cloud.example.com/remote.php/dav/calendars/alice/');

        return new Response(
          `<?xml version="1.0" encoding="utf-8"?>
           <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
             <d:response>
               <d:href>/remote.php/dav/calendars/alice/personal/</d:href>
               <d:propstat>
                 <d:prop>
                   <d:resourcetype>
                     <d:collection/>
                     <c:calendar/>
                   </d:resourcetype>
                 </d:prop>
               </d:propstat>
             </d:response>
           </d:multistatus>`,
          { status: 207 }
        );
      }

      if (method === 'REPORT') {
        const requestBody = String(init?.body ?? '');
        const component = requestBody.includes('name="VEVENT"') ? 'VEVENT' : 'VTODO';

        if (component === 'VTODO') {
          return new Response(
            `<?xml version="1.0" encoding="utf-8"?>
             <multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
               <response><propstat><prop><cal:calendar-data>
BEGIN:VCALENDAR
BEGIN:VTODO
UID:todo-nc-1
SUMMARY:Nextcloud Task
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
UID:event-nc-1
SUMMARY:Nextcloud Event
DTSTART:20280101T090000Z
DTEND:20280101T093000Z
END:VEVENT
END:VCALENDAR
             </cal:calendar-data></prop></propstat></response>
           </multistatus>`,
          { status: 200 }
        );
      }

      return new Response('not found', { status: 404 });
    };

    const result = await fetchCaldavAgendaDetailed({
      serverUrl: 'https://cloud.example.com',
      username: 'alice',
      appPassword: 'secret'
    });

    if (typeof DOMParser === 'undefined') {
      expect(result.errorDetail).toContain('parsing unavailable');
      return;
    }

    expect(result.errorDetail).toBeUndefined();
    expect(result.events[0]?.title).toBe('Nextcloud Event');
    expect(result.todos[0]?.title).toBe('Nextcloud Task');
  });

  test('discovers calendar collections via current-user-principal flow', async () => {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      const requestBody = String(init?.body ?? '');

      if (method === 'PROPFIND' && requestBody.includes('current-user-principal')) {
        expect(url).toBe('https://cloud.example.com/remote.php/dav');
        return new Response(
          `<?xml version="1.0" encoding="utf-8"?>
           <d:multistatus xmlns:d="DAV:">
             <d:response>
               <d:propstat>
                 <d:prop>
                   <d:current-user-principal>
                     <d:href>/remote.php/dav/principals/users/internal-id-42/</d:href>
                   </d:current-user-principal>
                 </d:prop>
               </d:propstat>
             </d:response>
           </d:multistatus>`,
          { status: 207 }
        );
      }

      if (method === 'PROPFIND' && requestBody.includes('calendar-home-set')) {
        expect(url).toBe('https://cloud.example.com/remote.php/dav/principals/users/internal-id-42/');
        return new Response(
          `<?xml version="1.0" encoding="utf-8"?>
           <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
             <d:response>
               <d:propstat>
                 <d:prop>
                   <c:calendar-home-set>
                     <d:href>/remote.php/dav/calendars/internal-id-42/</d:href>
                   </c:calendar-home-set>
                 </d:prop>
               </d:propstat>
             </d:response>
           </d:multistatus>`,
          { status: 207 }
        );
      }

      if (method === 'PROPFIND' && requestBody.includes('resourcetype')) {
        expect(url).toBe('https://cloud.example.com/remote.php/dav/calendars/internal-id-42/');
        return new Response(
          `<?xml version="1.0" encoding="utf-8"?>
           <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
             <d:response>
               <d:href>/remote.php/dav/calendars/internal-id-42/personal/</d:href>
               <d:propstat>
                 <d:prop>
                   <d:resourcetype>
                     <d:collection/>
                     <c:calendar/>
                   </d:resourcetype>
                 </d:prop>
               </d:propstat>
             </d:response>
           </d:multistatus>`,
          { status: 207 }
        );
      }

      if (method === 'REPORT') {
        if (requestBody.includes('name="VEVENT"')) {
          return new Response(
            `<?xml version="1.0" encoding="utf-8"?>
             <multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
               <response><propstat><prop><cal:calendar-data>
BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-principal-1
SUMMARY:Principal Event
DTSTART:20280102T090000Z
DTEND:20280102T093000Z
END:VEVENT
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
BEGIN:VTODO
UID:todo-principal-1
SUMMARY:Principal Task
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR
             </cal:calendar-data></prop></propstat></response>
           </multistatus>`,
          { status: 200 }
        );
      }

      return new Response('not found', { status: 404 });
    };

    const result = await fetchCaldavAgendaDetailed({
      serverUrl: 'https://cloud.example.com/remote.php/dav',
      username: 'alice@example.com',
      appPassword: 'secret'
    });

    if (typeof DOMParser === 'undefined') {
      expect(result.errorDetail).toContain('parsing unavailable');
      return;
    }

    expect(result.errorDetail).toBeUndefined();
    expect(result.events[0]?.title).toBe('Principal Event');
    expect(result.todos[0]?.title).toBe('Principal Task');
  });
});
