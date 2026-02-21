# Integrations

## CalDAV

- Initial stage is read-only.
- Browser adapter now issues CalDAV `calendar-query` REPORT requests for
  `VEVENT` and `VTODO` components.
- Event and todo properties are parsed from `calendar-data` iCalendar payloads
  and normalized into `DashboardEvent` and `DashboardTodo` models.
- Adapter supports optional separate todo collection URL and degrades to empty
  data on network/auth/CORS failure.
- Calendar and todo URLs can be configured through first-run onboarding and
  are persisted as user profile settings.

## Obsidian

- Desktop-first support using local vault path.
- Desktop app now exposes a Tauri command that scans markdown files in the
  configured vault and returns recent notes by modified time.
- Browser adapter invokes this command when running in Tauri and maps
  note metadata into `DashboardNote` rows.
- Initial stage remains read-only and does not modify vault files.

## RSS

- Browser adapter currently fetches configured RSS/Atom URLs and normalizes
  titles, links, source names, and publish timestamps.
- Feed parsing is dependency-light and supports both RSS channel items and
  Atom entries.
- Browser-mode fetching requires target feeds to allow CORS.
- Dashboard periodically refreshes RSS data in the background and caches results
  with a configurable TTL.
- Widget header metadata now shows relative freshness (for example, `Updated 2m ago`
  or `Cached 30s ago`) so users can tell when feed data was last refreshed.
- Relative freshness labels are recomputed on a short interval so displayed age
  stays accurate while the dashboard remains open.
- When refresh fails, the widget now exposes adapter diagnostic detail in the
  card status tooltip and inline error text.

## Uptime Kuma

- Browser adapter currently resolves status page URLs to
  `/api/status-page/<slug>` when needed.
- Parses grouped and ungrouped monitor payloads, normalizes status and latency,
  and deduplicates monitor rows.
- Dashboard uses Rust WASM normalization to enforce consistent monitor ordering
  when WASM module is available.
- Monitor status is periodically refreshed in the background and cached with a
  configurable TTL.
- Widget header metadata now shows relative freshness (for example, `Updated 10s ago`
  or `Cached 1m ago`) to make stale/fresh state explicit.
- Relative freshness labels are recomputed on a short interval so displayed age
  stays accurate while the dashboard remains open.
- When refresh fails, the widget now exposes adapter diagnostic detail in the
  card status tooltip and inline error text.

## Email

- Browser adapter parses and normalizes configured inbox shortcuts from
  `PUBLIC_EMAIL_LINKS` (`Label|URL,Label|URL`).
- Dashboard email widget now loads configured providers at runtime with
  deduplication and basic validation.
- First-run onboarding offers provider presets (Fastmail, Gmail, Outlook,
  Proton Mail, or custom URL) and optional additional links.
- Full email client behavior is intentionally out of scope in this stage.
