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
- `PUBLIC_OBSIDIAN_VAULT_PATH`: local vault path used by desktop note indexing.
- `PUBLIC_EMAIL_LINKS`: comma-separated `Label|URL` inbox links for the email widget.
- `PUBLIC_RSS_CACHE_TTL_SECONDS`: RSS cache TTL in seconds for browser local cache.
- `PUBLIC_STATUS_CACHE_TTL_SECONDS`: service-status cache TTL in seconds for browser local cache.
- `PUBLIC_FEED_STATUS_REFRESH_SECONDS`: polling interval in seconds for RSS and status refresh.

## In-app overrides (RSS and status)

The dashboard now includes an in-app settings panel for feed and status sources.
These values are persisted in browser local storage and override `PUBLIC_*`
environment defaults for that browser profile.

Overridable values:

- RSS sources list
- Uptime Kuma status URL
- Refresh interval
- RSS cache TTL
- Status cache TTL

This is intended for non-secret endpoint tuning only.

## Onboarding profile setup

The dashboard now includes a first-run onboarding modal that captures:

- Primary email provider and optional custom/additional inbox links
- RSS source URLs
- Uptime Kuma status URL
- CalDAV calendar and todo collection URLs

Onboarding values are persisted in browser local storage (`notedash:user-profile:v1`)
and used by widgets as profile defaults. You can reopen onboarding from the hero
section to update these values later.

Examples:

```env
PUBLIC_CALDAV_CALENDAR_URL=https://dav.example.com/calendars/user/main/
PUBLIC_CALDAV_TODO_URL=https://dav.example.com/calendars/user/tasks/
PUBLIC_OBSIDIAN_VAULT_PATH=/home/you/notes
PUBLIC_EMAIL_LINKS=Fastmail|https://app.fastmail.com,Gmail|https://mail.google.com
PUBLIC_RSS_FEED_URLS=https://hnrss.org/frontpage,https://planet.svelte.dev/rss.xml
PUBLIC_RSS_CACHE_TTL_SECONDS=600
PUBLIC_UPTIME_KUMA_STATUS_URL=https://status.example.com/status/main
PUBLIC_STATUS_CACHE_TTL_SECONDS=60
PUBLIC_FEED_STATUS_REFRESH_SECONDS=180
```

Notes:

- RSS URLs are fetched directly by the browser, so CORS must allow access.
- If `PUBLIC_UPTIME_KUMA_STATUS_URL` is a page URL, the adapter derives
  `/api/status-page/<slug>` automatically.
- CalDAV browser mode works best with read-only app URLs and permissive CORS.
- For authenticated CalDAV, use desktop secure storage and a non-public adapter path.
- Obsidian vault path is used only in desktop mode; browser mode ignores it.
- Email links are non-secret shortcuts and can safely be public configuration.
- RSS and status widgets keep a TTL-based local cache for faster dashboard loads.
- RSS and status widgets refresh in the background using a configurable interval.
- RSS and status card headers surface relative freshness labels derived from
  cache and refresh timestamps.
- Do not place secrets in `PUBLIC_*` variables.

## Security notes

- Store secrets in secure desktop storage when running as Tauri app.
- Avoid persisting raw secrets in browser local storage.
