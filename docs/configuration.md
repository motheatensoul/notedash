# Configuration

## Dashboard configuration shape

Dashboard config is modeled as pages and widgets. The first implementation ships a single page with multiple widget cards.

## Required settings

- CalDAV server URL, username, and app password.
- Obsidian vault path (desktop).
- RSS feed URLs.
- Uptime Kuma status endpoint URL.
- Email provider links.

## Web environment variables

The current web build reads public, non-secret integration settings from
`apps/web/.env` (or your deployment environment):

- `PUBLIC_RSS_FEED_URLS`: comma-separated RSS/Atom URLs.
- `PUBLIC_UPTIME_KUMA_STATUS_URL`: Uptime Kuma status page URL or API endpoint.
- `PUBLIC_CALDAV_CALENDAR_URL`: CalDAV calendar collection URL for VEVENT queries.
- `PUBLIC_CALDAV_TODO_URL`: optional CalDAV todo collection URL for VTODO queries.

Examples:

```env
PUBLIC_CALDAV_CALENDAR_URL=https://dav.example.com/calendars/user/main/
PUBLIC_CALDAV_TODO_URL=https://dav.example.com/calendars/user/tasks/
PUBLIC_RSS_FEED_URLS=https://hnrss.org/frontpage,https://planet.svelte.dev/rss.xml
PUBLIC_UPTIME_KUMA_STATUS_URL=https://status.example.com/status/main
```

Notes:

- RSS URLs are fetched directly by the browser, so CORS must allow access.
- If `PUBLIC_UPTIME_KUMA_STATUS_URL` is a page URL, the adapter derives
  `/api/status-page/<slug>` automatically.
- CalDAV browser mode works best with read-only app URLs and permissive CORS.
- For authenticated CalDAV, use desktop secure storage and a non-public adapter path.
- Do not place secrets in `PUBLIC_*` variables.

## Security notes

- Store secrets in secure desktop storage when running as Tauri app.
- Avoid persisting raw secrets in browser local storage.
