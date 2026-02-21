# Architecture

## High-level structure

Notedash uses a split architecture so one dashboard codebase can run both in a browser and in a desktop shell:

- `apps/web`: SvelteKit static SPA that renders widgets and manages settings.
- `apps/desktop`: Tauri app that hosts the same frontend output.
- `crates/core`: Rust crate containing shared domain models and normalization logic, compiled to native and WASM targets.

## Runtime model

1. Widget registry loads enabled widgets from a typed dashboard config.
2. Each widget uses an adapter that retrieves and normalizes source data.
3. Widgets render into a responsive card grid with common loading/error/empty states.
4. Data refresh policy is per-widget, with cache metadata tracked in the frontend store.

## Settings and onboarding

- Runtime feed/status settings are persisted in browser local storage and override
  public environment defaults for the current profile.
- User profile settings store onboarding-driven values such as email links,
  CalDAV URLs, and Obsidian vault path.
- Onboarding dismissal is tracked per browser session so "Skip for now" only
  suppresses the modal until the tab/session is restarted.
- The onboarding modal and setup checklist provide a guided first-run path and
  explicit setup-health feedback (`ok`, `warn`, `todo`).

## Reliability model

- Adapters return detailed diagnostics for failure paths where practical.
- Widgets expose freshness state (`loading`, `ok`, `stale`, `error`) with
  relative update/cached metadata.
- RSS and Uptime Kuma use TTL-backed cache hydration plus background refresh.

## Capability differences

- Desktop mode can read local vault files and use secure credential storage.
- Browser mode uses network-only adapters unless a connector service is later introduced.

## WASM boundary

Rust code in `crates/core` owns:

- Shared domain data shapes.
- Timestamp ordering and normalization helpers.
- Cross-integration utility logic.

Frontend code consumes the generated WASM package and applies thin TypeScript wrappers.
