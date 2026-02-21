# Configuration

## Dashboard configuration shape

Dashboard config is modeled as pages and widgets. The first implementation ships a single page with multiple widget cards.

## Required settings

- CalDAV server URL, username, and app password.
- Obsidian vault path (desktop).
- RSS feed URLs.
- Uptime Kuma status endpoint URL.
- Email provider links.

## Security notes

- Store secrets in secure desktop storage when running as Tauri app.
- Avoid persisting raw secrets in browser local storage.
