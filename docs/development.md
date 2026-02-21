# Development

## Prerequisites

- Bun 1.2+
- Rust stable toolchain
- `wasm-pack`

## Commands

- `bun run dev`: run the root desktop development entrypoint (Tauri + web).
- `bun run dev:browser`: run browser-only frontend development.
- `bun run test:web`: run web-layer unit tests with Bun.
- `just wasm`: build Rust core to `apps/web/src/lib/wasm`.
- `just web-dev`: run SvelteKit development server.
- `just web-build`: build static web assets.
- `just web-check`: run type checks.

## Workflow

1. Build WASM package whenever Rust core changes.
2. Run web dev server for UI and adapter iteration.
3. Keep integration logic in adapter modules, not in view components.
4. Run `bun run test:web` before pushing to validate adapter and settings logic.

## CI

GitHub Actions workflow `ci.yml` runs on push and pull requests and executes:

- `bun run test:web`
- `bun run check:web`
- `bun run build:web`
- `cargo check --workspace`
