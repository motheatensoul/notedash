# Development

## Prerequisites

- Bun 1.2+
- Rust stable toolchain
- `wasm-pack`

## Commands

- `bun run dev`: run the root desktop development entrypoint (Tauri + web).
- `bun run dev:browser`: run browser-only frontend development.
- `bun run --cwd apps/web clean:cache`: clear Vite and SvelteKit cache directories before a fresh web run.
- `bun run test:web`: run web-layer unit tests with Bun.
- `bun run verify`: run the full root validation suite.
- `just wasm`: build Rust core to `apps/web/src/lib/wasm`.
- `just wasm-verbose`: build Rust core to `apps/web/src/lib/wasm` with verbose cargo logs.
- `just web-dev`: run SvelteKit development server.
- `just web-build`: build static web assets.
- `just web-check`: run type checks.
- `just web-test`: run web unit tests.
- `just verify`: run tests, checks, WASM build, web build, and Rust checks.

## Workflow

1. Build WASM package whenever Rust core changes.
2. Run web dev server for UI and adapter iteration.
3. Keep integration logic in adapter modules, not in view components.
4. Run `bun run test:web` before pushing to validate adapter and settings logic.
5. If Vite reports stale transform or plugin errors during iteration, run `bun run --cwd apps/web clean:cache` and restart dev.

## Frontend theming

- Notedash now uses `shadcn-svelte` with Tailwind v4 primitives.
- Global theme tokens and project aliases live in `apps/web/src/app.css`; the stylesheet is loaded via `apps/web/src/routes/+layout.svelte`.
- Generated `shadcn-svelte` UI components live under `apps/web/src/lib/components/ui/` and should be reused for buttons, inputs, badges, cards, dialogs, and similar controls.
- Keep existing component colors wired through `--nd-*` aliases so legacy surfaces and new shadcn components remain visually consistent.
- Prefer `@lucide/svelte` for dashboard icons to keep visual language consistent.

## CI

GitHub Actions workflow `ci.yml` runs on push and pull requests and executes:

- `bun run verify`

## Troubleshooting setup

- Use the setup checklist `Run checks` button to force immediate integration
  refreshes (CalDAV, notes, RSS, status) after changing configuration.
- `Skip for now` in onboarding is session-scoped; restart the tab/session to
  see onboarding again if setup is incomplete.
- If `just wasm` fails with `linking with gcc failed` and
  `--target=wasm32-unknown-unknown`, clear host linker overrides before running
  wasm builds. The `just wasm` recipe now does this automatically.
