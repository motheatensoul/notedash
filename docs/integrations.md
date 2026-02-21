# Integrations

## CalDAV

- Initial stage is read-only.
- Pull upcoming events and open todos.
- Normalize into shared `DashboardEvent` and `DashboardTodo` models.

## Obsidian

- Desktop-first support using local vault path.
- Show recent notes and pinned notes metadata.
- Initial stage does not modify note files.

## RSS

- Poll configured feeds on user-defined interval.
- Keep item metadata and source links.

## Uptime Kuma

- Consume configured status endpoint JSON.
- Render monitor state, latency, and grouping labels where available.

## Email

- Provide quick links to configured inbox providers.
- Full email client behavior is intentionally out of scope in this stage.
