import type { DashboardEvent, DashboardTodo } from '@notedash/types';

/**
 * Defines CalDAV collection and authentication settings.
 */
export interface CaldavAdapterConfig {
  serverUrl: string;
  username?: string;
  appPassword?: string;
  todoUrl?: string;
  lookaheadDays?: number;
}

/**
 * Defines normalized agenda payload loaded from CalDAV.
 */
export interface CaldavAgendaPayload {
  events: DashboardEvent[];
  todos: DashboardTodo[];
}

/**
 * Fetches read-only agenda data from CalDAV calendar and todo collections.
 */
export async function fetchCaldavAgenda(config: CaldavAdapterConfig): Promise<CaldavAgendaPayload> {
  const calendarUrl = config.serverUrl.trim();
  const todoUrl = config.todoUrl?.trim();

  if (!calendarUrl && !todoUrl) {
    return {
      events: [],
      todos: []
    };
  }

  const [events, todos] = await Promise.all([
    calendarUrl
      ? fetchCollectionItems({
          url: calendarUrl,
          componentName: 'VEVENT',
          username: config.username,
          appPassword: config.appPassword,
          lookaheadDays: config.lookaheadDays
        }).then((blocks) => parseEvents(blocks))
      : Promise.resolve([]),
    (todoUrl || calendarUrl)
      ? fetchCollectionItems({
          url: todoUrl || calendarUrl,
          componentName: 'VTODO',
          username: config.username,
          appPassword: config.appPassword,
          lookaheadDays: config.lookaheadDays
        }).then((blocks) => parseTodos(blocks))
      : Promise.resolve([])
  ]);

  return {
    events,
    todos
  };
}

/**
 * Defines collection fetch options for CalDAV REPORT queries.
 */
interface CollectionFetchOptions {
  url: string;
  componentName: 'VEVENT' | 'VTODO';
  username?: string;
  appPassword?: string;
  lookaheadDays?: number;
}

/**
 * Fetches iCalendar payload blocks from a CalDAV collection.
 */
async function fetchCollectionItems(options: CollectionFetchOptions): Promise<string[]> {
  const headers = new Headers();
  headers.set('Depth', '1');
  headers.set('Content-Type', 'application/xml; charset=utf-8');

  const authHeader = createBasicAuthHeader(options.username, options.appPassword);
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  const response = await fetch(options.url, {
    method: 'REPORT',
    headers,
    body: buildCalendarQueryBody(options.componentName, options.lookaheadDays)
  }).catch(() => null);

  if (!response || !response.ok) {
    return [];
  }

  const xml = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return [];
  }

  const calendarDataNodes = [
    ...doc.querySelectorAll('calendar-data'),
    ...doc.querySelectorAll('cal\\:calendar-data')
  ];

  return calendarDataNodes
    .map((node) => node.textContent?.trim() ?? '')
    .filter((value) => value.includes('BEGIN:VCALENDAR'));
}

/**
 * Builds a minimal CalDAV calendar-query REPORT body.
 */
function buildCalendarQueryBody(componentName: 'VEVENT' | 'VTODO', lookaheadDays = 60): string {
  const range = componentName === 'VEVENT' ? buildTimeRange(lookaheadDays) : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="${componentName}">
        ${range}
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
}

/**
 * Creates a UTC time range filter string for event queries.
 */
function buildTimeRange(lookaheadDays: number): string {
  const now = new Date();
  const end = new Date(now.getTime() + Math.max(1, lookaheadDays) * 24 * 60 * 60 * 1000);

  return `<c:time-range start="${toCalDavTimestamp(now)}" end="${toCalDavTimestamp(end)}" />`;
}

/**
 * Formats a date into CalDAV UTC timestamp format.
 */
function toCalDavTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Creates a basic authentication header from optional credentials.
 */
function createBasicAuthHeader(username?: string, password?: string): string | undefined {
  if (!username || !password) {
    return undefined;
  }

  return `Basic ${btoa(`${username}:${password}`)}`;
}

/**
 * Parses VEVENT blocks from iCalendar payloads.
 */
function parseEvents(icalBlocks: string[]): DashboardEvent[] {
  const events = icalBlocks.flatMap((block) => extractComponentMaps(block, 'VEVENT')).map((entry, index) => {
    const startsAtIso = parseIcalDate(entry.get('DTSTART')) ?? new Date(0).toISOString();
    const endsAtIso =
      parseIcalDate(entry.get('DTEND')) ??
      new Date(new Date(startsAtIso).getTime() + 60 * 60 * 1000).toISOString();

    return {
      id: entry.get('UID') || `caldav-event-${index}`,
      title: entry.get('SUMMARY') || 'Untitled Event',
      startsAtIso,
      endsAtIso,
      source: 'caldav' as const
    };
  });

  return events.sort((left, right) => left.startsAtIso.localeCompare(right.startsAtIso));
}

/**
 * Parses VTODO blocks from iCalendar payloads.
 */
function parseTodos(icalBlocks: string[]): DashboardTodo[] {
  const todos = icalBlocks.flatMap((block) => extractComponentMaps(block, 'VTODO')).map((entry, index) => {
    const status = (entry.get('STATUS') || '').toUpperCase();
    const completed = entry.has('COMPLETED') || status === 'COMPLETED';

    return {
      id: entry.get('UID') || `caldav-todo-${index}`,
      title: entry.get('SUMMARY') || 'Untitled Task',
      done: completed,
      source: 'caldav' as const
    };
  });

  return todos.sort((left, right) => Number(left.done) - Number(right.done));
}

/**
 * Extracts component property maps from iCalendar text.
 */
function extractComponentMaps(
  ical: string,
  componentName: 'VEVENT' | 'VTODO'
): Array<Map<string, string>> {
  const unfolded = unfoldIcalLines(ical);
  const rows = unfolded.split(/\r?\n/);
  const records: Array<Map<string, string>> = [];
  let current: Map<string, string> | null = null;

  for (const row of rows) {
    if (row === `BEGIN:${componentName}`) {
      current = new Map<string, string>();
      continue;
    }

    if (row === `END:${componentName}`) {
      if (current) {
        records.push(current);
      }
      current = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const separatorIndex = row.indexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const keyWithParams = row.slice(0, separatorIndex);
    const key = keyWithParams.split(';')[0].toUpperCase();
    const value = row.slice(separatorIndex + 1).trim();

    if (!current.has(key)) {
      current.set(key, value);
    }
  }

  return records;
}

/**
 * Unfolds folded iCalendar lines into single-line property rows.
 */
function unfoldIcalLines(ical: string): string {
  return ical.replace(/\r?\n[ \t]/g, '');
}

/**
 * Parses iCalendar date and date-time values into ISO strings.
 */
function parseIcalDate(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number.parseInt(trimmed.slice(0, 4), 10);
    const month = Number.parseInt(trimmed.slice(4, 6), 10) - 1;
    const day = Number.parseInt(trimmed.slice(6, 8), 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0)).toISOString();
  }

  if (/^\d{8}T\d{6}Z$/.test(trimmed)) {
    const year = Number.parseInt(trimmed.slice(0, 4), 10);
    const month = Number.parseInt(trimmed.slice(4, 6), 10) - 1;
    const day = Number.parseInt(trimmed.slice(6, 8), 10);
    const hour = Number.parseInt(trimmed.slice(9, 11), 10);
    const minute = Number.parseInt(trimmed.slice(11, 13), 10);
    const second = Number.parseInt(trimmed.slice(13, 15), 10);
    return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
  }

  if (/^\d{8}T\d{6}$/.test(trimmed)) {
    const year = Number.parseInt(trimmed.slice(0, 4), 10);
    const month = Number.parseInt(trimmed.slice(4, 6), 10) - 1;
    const day = Number.parseInt(trimmed.slice(6, 8), 10);
    const hour = Number.parseInt(trimmed.slice(9, 11), 10);
    const minute = Number.parseInt(trimmed.slice(11, 13), 10);
    const second = Number.parseInt(trimmed.slice(13, 15), 10);
    return new Date(year, month, day, hour, minute, second).toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}
