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
 * Defines read-only CalDAV agenda output with optional diagnostics.
 */
export interface CaldavAgendaFetchResult extends CaldavAgendaPayload {
  errorDetail?: string;
}

interface DesktopCaldavResponse {
  status: number;
  body: string;
}

interface DavRequestResult {
  status: number;
  body: string;
}

const DESKTOP_DAV_REQUEST_TIMEOUT_MS = 20000;

/**
 * Detects whether the current runtime is a Tauri WebView.
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
}

/**
 * Executes a DAV request using desktop bridge when available.
 */
async function requestDav(options: {
  url: string;
  method: 'PROPFIND' | 'REPORT';
  body: string;
  depth: '0' | '1';
  username?: string;
  appPassword?: string;
}): Promise<DavRequestResult | null> {
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const response = await Promise.race([
        invoke<DesktopCaldavResponse>('desktop_caldav_request', {
          url: options.url,
          method: options.method,
          body: options.body,
          depth: options.depth,
          username: options.username,
          appPassword: options.appPassword
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('desktop CalDAV request timed out'));
          }, DESKTOP_DAV_REQUEST_TIMEOUT_MS);
        })
      ]);

      return {
        status: response.status,
        body: response.body
      };
    } catch {
      return null;
    }
  }

  const headers = new Headers();
  headers.set('Depth', options.depth);
  headers.set('Content-Type', 'application/xml; charset=utf-8');

  const authHeader = createBasicAuthHeader(options.username, options.appPassword);
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  const response = await fetch(options.url, {
    method: options.method,
    headers,
    body: options.body
  }).catch(() => null);

  if (!response) {
    return null;
  }

  return {
    status: response.status,
    body: await response.text()
  };
}

/**
 * Fetches read-only agenda data from CalDAV calendar and todo collections.
 */
export async function fetchCaldavAgenda(config: CaldavAdapterConfig): Promise<CaldavAgendaPayload> {
  const result = await fetchCaldavAgendaDetailed(config);
  return {
    events: result.events,
    todos: result.todos
  };
}

/**
 * Fetches read-only CalDAV data and includes optional diagnostics.
 */
export async function fetchCaldavAgendaDetailed(
  config: CaldavAdapterConfig
): Promise<CaldavAgendaFetchResult> {
  const calendarUrl = config.serverUrl.trim();
  const todoUrl = config.todoUrl?.trim() ?? '';

  if (!calendarUrl && !todoUrl) {
    return {
      events: [],
      todos: []
    };
  }

  const resolvedUrls = await resolveCollectionUrls({
    calendarUrl,
    todoUrl,
    username: config.username,
    appPassword: config.appPassword
  });

  const [eventsResult, todosResult] = await Promise.all([
    resolvedUrls.calendarUrls.length > 0
      ? fetchComponentAcrossCollections({
          urls: resolvedUrls.calendarUrls,
          componentName: 'VEVENT',
          username: config.username,
          appPassword: config.appPassword,
          lookaheadDays: config.lookaheadDays
        }).then((result) => ({
          events: parseEvents(result.blocks),
          error: result.error
        }))
      : Promise.resolve({ events: [] as DashboardEvent[], error: undefined as string | undefined }),
    resolvedUrls.todoUrls.length > 0
      ? fetchComponentAcrossCollections({
          urls: resolvedUrls.todoUrls,
          componentName: 'VTODO',
          username: config.username,
          appPassword: config.appPassword,
          lookaheadDays: config.lookaheadDays
        }).then((result) => ({
          todos: parseTodos(result.blocks),
          error: result.error
        }))
      : Promise.resolve({ todos: [] as DashboardTodo[], error: undefined as string | undefined })
  ]);

  const events = eventsResult.events;
  const todos = todosResult.todos;
  const errors = [eventsResult.error, todosResult.error].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  if (errors.length > 0 && events.length === 0 && todos.length === 0) {
    return {
      events,
      todos,
      errorDetail: errors.slice(0, 2).join('; ')
    };
  }

  return {
    events,
    todos
  };
}

interface CollectionResolutionOptions {
  calendarUrl: string;
  todoUrl: string;
  username?: string;
  appPassword?: string;
}

interface CollectionResolutionResult {
  calendarUrls: string[];
  todoUrls: string[];
}

/**
 * Resolves collection URLs, including login-only Nextcloud configurations.
 */
async function resolveCollectionUrls(
  options: CollectionResolutionOptions
): Promise<CollectionResolutionResult> {
  const calendarCandidates = uniqueUrls([
    options.calendarUrl,
    buildNextcloudCalendarHomeUrl(options.calendarUrl, options.username)
  ]);

  const resolvedCalendarUrls = await discoverCollectionUrls(calendarCandidates, {
    username: options.username,
    appPassword: options.appPassword
  });

  const calendarUrls =
    resolvedCalendarUrls.length > 0
      ? resolvedCalendarUrls
      : calendarCandidates.filter((value) => value.length > 0);

  const todoCandidates =
    options.todoUrl.length > 0 ? uniqueUrls([options.todoUrl]) : uniqueUrls(calendarUrls);

  const resolvedTodoUrls = await discoverCollectionUrls(todoCandidates, {
    username: options.username,
    appPassword: options.appPassword
  });

  return {
    calendarUrls,
    todoUrls: resolvedTodoUrls.length > 0 ? resolvedTodoUrls : todoCandidates
  };
}

interface CollectionDiscoveryAuth {
  username?: string;
  appPassword?: string;
}

/**
 * Discovers concrete calendar collection URLs from candidate endpoints.
 */
async function discoverCollectionUrls(
  candidates: string[],
  auth: CollectionDiscoveryAuth
): Promise<string[]> {
  const resolved: string[] = [];

  for (const candidate of candidates) {
    if (isLikelyCollectionEndpoint(candidate)) {
      resolved.push(candidate);
      continue;
    }

    const principalCollections = await fetchCollectionsFromPrincipal(candidate, auth);
    if (principalCollections.length > 0) {
      resolved.push(...principalCollections);
      continue;
    }

    const discovered = await fetchCalendarCollectionUrls(candidate, auth);
    if (discovered.length > 0) {
      resolved.push(...discovered);
    }
  }

  return uniqueUrls(resolved);
}

/**
 * Discovers calendar collections through DAV principal metadata.
 */
async function fetchCollectionsFromPrincipal(
  rawUrl: string,
  auth: CollectionDiscoveryAuth
): Promise<string[]> {
  const principalUrl = await fetchCurrentUserPrincipalUrl(rawUrl, auth);
  if (!principalUrl) {
    return [];
  }

  const calendarHomes = await fetchCalendarHomeSetUrls(principalUrl, auth);
  if (calendarHomes.length === 0) {
    return [];
  }

  const allCollections: string[] = [];
  for (const homeUrl of calendarHomes) {
    const discoveredCollections = await fetchCalendarCollectionUrls(homeUrl, auth);
    if (discoveredCollections.length > 0) {
      allCollections.push(...discoveredCollections);
      continue;
    }

    allCollections.push(homeUrl);
  }

  return uniqueUrls(allCollections);
}

/**
 * Reads the current-user-principal URL from a DAV endpoint.
 */
async function fetchCurrentUserPrincipalUrl(
  rawUrl: string,
  auth: CollectionDiscoveryAuth
): Promise<string | null> {
  const document = await fetchDavPropertyDocument(rawUrl, buildCurrentUserPrincipalBody(), auth, '0');
  if (!document) {
    return null;
  }

  const href =
    document.querySelector('current-user-principal href')?.textContent ??
    document.querySelector('d\\:current-user-principal d\\:href')?.textContent ??
    document.querySelector('href')?.textContent ??
    null;

  if (!href) {
    return null;
  }

  return toAbsoluteUrl(href.trim(), rawUrl);
}

/**
 * Reads calendar-home-set URLs from a principal endpoint.
 */
async function fetchCalendarHomeSetUrls(
  principalUrl: string,
  auth: CollectionDiscoveryAuth
): Promise<string[]> {
  const document = await fetchDavPropertyDocument(
    principalUrl,
    buildCalendarHomeSetBody(),
    auth,
    '0'
  );
  if (!document) {
    return [];
  }

  const homeNodes = [
    ...document.querySelectorAll('calendar-home-set href'),
    ...document.querySelectorAll('cal\\:calendar-home-set d\\:href'),
    ...document.querySelectorAll('c\\:calendar-home-set d\\:href')
  ];

  return uniqueUrls(
    homeNodes
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean)
      .map((value) => toAbsoluteUrl(value, principalUrl))
  );
}

/**
 * Executes a DAV PROPFIND request and returns parsed XML document.
 */
async function fetchDavPropertyDocument(
  rawUrl: string,
  body: string,
  auth: CollectionDiscoveryAuth,
  depth: '0' | '1'
): Promise<Document | null> {
  const response = await requestDav({
    url: rawUrl,
    method: 'PROPFIND',
    body,
    depth,
    username: auth.username,
    appPassword: auth.appPassword
  });

  if (!response || response.status < 200 || response.status >= 300 || typeof DOMParser === 'undefined') {
    return null;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(response.body, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return null;
  }

  return doc;
}

/**
 * Returns whether an endpoint likely points to a concrete collection already.
 */
function isLikelyCollectionEndpoint(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname.replace(/\/+/g, '/').replace(/\/$/, '');

    if (path === '' || path === '/') {
      return false;
    }

    if (path === '/remote.php/dav' || path === '/remote.php/dav/calendars') {
      return false;
    }

    if (/\/remote\.php\/dav\/calendars\/[^/]+$/.test(path)) {
      return false;
    }

    if (path.includes('/index.php/login')) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Builds a Nextcloud calendar-home URL from a base/login URL and username.
 */
function buildNextcloudCalendarHomeUrl(rawUrl: string, username?: string): string {
  const trimmedUsername = username?.trim() ?? '';
  if (!trimmedUsername || !rawUrl) {
    return '';
  }

  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname.replace(/\/+/g, '/');
    if (/\/remote\.php\/dav\/calendars\//.test(path)) {
      return '';
    }

    return `${parsed.origin}/remote.php/dav/calendars/${encodeURIComponent(trimmedUsername)}/`;
  } catch {
    return '';
  }
}

interface MultiCollectionFetchOptions {
  urls: string[];
  componentName: 'VEVENT' | 'VTODO';
  username?: string;
  appPassword?: string;
  lookaheadDays?: number;
}

interface MultiCollectionFetchResult {
  blocks: string[];
  error?: string;
}

/**
 * Fetches component payloads across one or more CalDAV collections.
 */
async function fetchComponentAcrossCollections(
  options: MultiCollectionFetchOptions
): Promise<MultiCollectionFetchResult> {
  const results = await Promise.all(
    options.urls.map((url) =>
      fetchCollectionItems({
        url,
        componentName: options.componentName,
        username: options.username,
        appPassword: options.appPassword,
        lookaheadDays: options.lookaheadDays
      })
    )
  );

  const blocks = results.flatMap((result) => result.blocks);
  const errors = results
    .map((result) => result.error)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (blocks.length === 0 && errors.length > 0) {
    return {
      blocks,
      error: errors.slice(0, 2).join('; ')
    };
  }

  return {
    blocks
  };
}

/**
 * Discovers CalDAV collection URLs from a potential calendar-home endpoint.
 */
async function fetchCalendarCollectionUrls(
  rawUrl: string,
  auth: CollectionDiscoveryAuth
): Promise<string[]> {
  const response = await requestDav({
    url: rawUrl,
    method: 'PROPFIND',
    body: buildCollectionDiscoveryBody(),
    depth: '1',
    username: auth.username,
    appPassword: auth.appPassword
  });

  if (!response || response.status < 200 || response.status >= 300) {
    return [];
  }

  const xml = response.body;
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return [];
  }

  const responseNodes = [...doc.querySelectorAll('response'), ...doc.querySelectorAll('d\\:response')];
  const urls = responseNodes
    .filter((node) => {
      const resourceTypeNode =
        node.querySelector('resourcetype') ?? node.querySelector('d\\:resourcetype');
      return Boolean(
        resourceTypeNode?.querySelector('calendar') ??
          resourceTypeNode?.querySelector('c\\:calendar') ??
          resourceTypeNode?.querySelector('cal\\:calendar')
      );
    })
    .map((node) => node.querySelector('href')?.textContent ?? node.querySelector('d\\:href')?.textContent ?? '')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => toAbsoluteUrl(value, rawUrl));

  return uniqueUrls(urls);
}

/**
 * Builds a DAV PROPFIND body used for calendar collection discovery.
 */
function buildCollectionDiscoveryBody(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:resourcetype />
  </d:prop>
</d:propfind>`;
}

/**
 * Builds a DAV PROPFIND body requesting current-user-principal.
 */
function buildCurrentUserPrincipalBody(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`;
}

/**
 * Builds a DAV PROPFIND body requesting calendar-home-set.
 */
function buildCalendarHomeSetBody(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`;
}

/**
 * Returns an absolute URL using the supplied base when needed.
 */
function toAbsoluteUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

/**
 * Returns de-duplicated non-empty URLs while preserving order.
 */
function uniqueUrls(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const rawValue of values) {
    const value = (rawValue ?? '').trim();
    if (!value) {
      continue;
    }

    const normalized = value.replace(/\/+$/, '');
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(value);
  }

  return output;
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

interface CollectionFetchResult {
  blocks: string[];
  error?: string;
}

/**
 * Fetches iCalendar payload blocks from a CalDAV collection.
 */
async function fetchCollectionItems(options: CollectionFetchOptions): Promise<CollectionFetchResult> {
  const response = await requestDav({
    url: options.url,
    method: 'REPORT',
    body: buildCalendarQueryBody(options.componentName, options.lookaheadDays),
    depth: '1',
    username: options.username,
    appPassword: options.appPassword
  });

  if (!response || response.status < 200 || response.status >= 300) {
    return {
      blocks: [],
      error: `${options.componentName} query failed${response ? ` (HTTP ${response.status})` : ' (network error)'}`
    };
  }

  const xml = response.body;
  if (typeof DOMParser === 'undefined') {
    return {
      blocks: [],
      error: `${options.componentName} query parsing unavailable in current runtime`
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return {
      blocks: [],
      error: `${options.componentName} query returned invalid XML`
    };
  }

  const calendarDataNodes = [
    ...doc.querySelectorAll('calendar-data'),
    ...doc.querySelectorAll('cal\\:calendar-data')
  ];

  return {
    blocks: calendarDataNodes
    .map((node) => node.textContent?.trim() ?? '')
    .filter((value) => value.includes('BEGIN:VCALENDAR'))
  };
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
