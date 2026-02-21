# Notedash Initial Implementation Plan

## Scope

- Build a unified dashboard app that runs in the browser and as a desktop app.
- Ship an initial widget experience for CalDAV, Obsidian, RSS, Uptime Kuma, and email links.
- Build shared domain logic in Rust with WebAssembly output from day one.

## Current delivery phases

1. Foundation
   - Monorepo with `apps/web`, `apps/desktop`, `crates/core`, `packages/*`.
   - SvelteKit SPA setup and base dashboard shell.
   - Tauri v2 skeleton configured to load the web bundle.
   - Rust `core` crate with shared data models and normalization helpers.
2. Core widgets
   - Agenda, Todos, Notes, RSS, Status, Email widget types.
   - Typed widget registry and consistent loading/error/empty states.
3. Integrations
   - Read-only CalDAV adapter.
   - Obsidian metadata index for desktop mode.
   - RSS polling with local cache metadata.
   - Uptime Kuma status endpoint adapter.
   - Email quick-link widget with optional unread indicator later.
4. Hardening
   - Add integration tests around adapters.
   - Add packaging and CI checks for web + wasm + desktop.

## Non-goals for this initial stage

- Full email client implementation.
- Collaborative backend service.
- Complex third-party plugin marketplace.
