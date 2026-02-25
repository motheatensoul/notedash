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

The settings panel also includes a **Reset Setup** action that clears persisted
runtime/profile overrides and reopens first-run onboarding. The action prompts
for confirmation before clearing local setup data.

This is intended for non-secret endpoint tuning only.

## Onboarding profile setup

The dashboard now includes a first-run onboarding modal that captures:

- Primary email provider and optional custom/additional inbox links
- RSS source URLs
- Uptime Kuma status URL
- CalDAV provider selection (Nextcloud, Fastmail, iCloud, Generic)
- CalDAV calendar/todo URLs plus optional username + app password
- Obsidian desktop vault path

Onboarding values are persisted in browser local storage (`notedash:user-profile:v1`)
and used by widgets as profile defaults. You can reopen onboarding from the hero
section to update these values later.

The onboarding form is split into focused steps (email links, feeds/status,
calendar sync, and notes source) so each screen captures one integration type
at a time.

The step rail supports quick backtracking and guarded forward navigation, so
users can revisit completed sections while still validating earlier steps before
jumping ahead.

It also includes field-level validation and guidance:

- URL fields validate `http://` and `https://` formats.
- Additional email links validate `Label|URL` entries.
- CalDAV credentials require both username and app password when either is set.
- CalDAV setup performs a live access check before onboarding can complete.
- Nextcloud provider includes browser sign-in (Login Flow v2) in desktop mode.
- Fastmail, iCloud, and Generic providers use manual CalDAV URL + credentials.
- Save is disabled until required setup values are valid.

Choosing "Skip for now" dismisses onboarding for the current session without
marking setup complete in persisted profile settings. The dismissal is stored
in browser session storage and resets when the tab/session is restarted.

After onboarding, the dashboard shows a setup checklist card that summarizes
configured integrations and links back to onboarding for quick fixes.

Use the checklist `Run checks` action to trigger immediate refresh across
profile-driven widgets and feed/status widgets when validating setup changes.

Dashboard settings are available from the hero `Settings` button and open in a
dedicated modal containing setup checklist, feed/status, and appearance cards.

## Appearance

Appearance preferences are stored in browser local storage
(`notedash:appearance-settings:v1`) and include:

- Theme mode: `system`, `light`, or `dark`
- Color theme: `default`, `ocean`, `forest`, or `sunset`

When theme mode is `system`, Notedash follows OS preference. In Linux desktop
mode, Notedash reads system preference through XDG desktop portals
(`org.freedesktop.portal.Settings`), then GNOME `gsettings`, and finally
`prefers-color-scheme` when portal values are unavailable.

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
- Nextcloud Login Flow v2 helper is desktop-only and opens the default browser
  for authentication before polling credentials through the desktop backend.
- In desktop mode, CalDAV credentials are saved in the OS secure credential
  store and not persisted in browser local storage.
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
