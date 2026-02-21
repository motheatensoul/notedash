# Notedash

Notedash is a unified personal dashboard designed to be a practical working homepage.
It combines calendar/tasks, notes, feeds, service health, and inbox shortcuts in a
single interface that runs both in the browser and as a desktop app.

## Current Status

This repository currently provides the project foundation:

- Monorepo layout for web, desktop, shared types, and shared Rust core logic
- SvelteKit dashboard shell with typed widget registry and initial widget cards
- Tauri v2 desktop host wired to the same frontend
- Rust core crate with WebAssembly build pipeline established from day one
- Integration adapter stubs for CalDAV, Obsidian, RSS, Uptime Kuma, and email links

Live service adapters are scaffolded and ready for incremental implementation.

## Architecture

- `apps/web`: SvelteKit SPA frontend and widget host
- `apps/desktop`: Tauri desktop application wrapper
- `crates/core`: Rust domain logic compiled for native and `wasm32`
- `packages/types`: Shared TypeScript contracts
- `docs`: Technical documentation for architecture, development, and integrations

For implementation details, see:

- `docs/architecture.md`
- `docs/development.md`
- `docs/integrations.md`
- `docs/configuration.md`
- `docs/security.md`

## Prerequisites

- Bun 1.2+
- Rust stable toolchain
- `wasm-pack`
- Platform requirements for Tauri development (system webview/tooling)

## Getting Started

Install dependencies:

```bash
bun install
```

Build the shared Rust WebAssembly package:

```bash
just wasm
```

Configure public feed/status sources for web mode:

```bash
cp apps/web/.env.example apps/web/.env
```

Run the desktop app (Tauri + frontend):

```bash
bun run dev
```

Run browser-only frontend development:

```bash
bun run dev:browser
```

## Common Commands

```bash
bun run check:web        # Svelte type and app checks
bun run build:web        # Production frontend build
bun run build:wasm       # Rebuild Rust WASM package
bun run build            # WASM + web build
bun run build:desktop    # Desktop production bundle
cargo check --workspace  # Rust workspace checks
```

## Roadmap Priorities

1. Add an onboarding modal for first-run setup of email provider links and service URLs
2. Expand Uptime Kuma and RSS adapters with richer health/error diagnostics
3. Continue CalDAV hardening with stronger compatibility coverage
4. Extend desktop Obsidian indexing with optional pinning/favorites metadata

## License

Licensed under the GNU General Public License v3.0 or later.
See `LICENSE` for the complete license text.
