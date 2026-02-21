# Integrations

## CalDAV

- Initial stage is read-only.
- Browser adapter now issues CalDAV `calendar-query` REPORT requests for
  `VEVENT` and `VTODO` components.
- Event and todo properties are parsed from `calendar-data` iCalendar payloads
  and normalized into `DashboardEvent` and `DashboardTodo` models.
- Adapter supports optional separate todo collection URL and degrades to empty
  data on network/auth/CORS failure.

## Obsidian

- Desktop-first support using local vault path.
- Show recent notes and pinned notes metadata.
- Initial stage does not modify note files.

## RSS

- Browser adapter currently fetches configured RSS/Atom URLs and normalizes
  titles, links, source names, and publish timestamps.
- Feed parsing is dependency-light and supports both RSS channel items and
  Atom entries.
- Browser-mode fetching requires target feeds to allow CORS.

## Uptime Kuma

- Browser adapter currently resolves status page URLs to
  `/api/status-page/<slug>` when needed.
- Parses grouped and ungrouped monitor payloads, normalizes status and latency,
  and deduplicates monitor rows.
- Dashboard uses Rust WASM normalization to enforce consistent monitor ordering
  when WASM module is available.

## Email

- Provide quick links to configured inbox providers.
- Full email client behavior is intentionally out of scope in this stage.
