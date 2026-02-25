# Important Instructions for Agents

The following instructions should never be deleted or moved under any circumstances and must obeyed at all times.

- keep usage of external dependencies to the absolute minimum while using industry standard solutions for solved problems (i.e. file parsing, auth, visuals, etc.)
- never trust that information from your training data is 100% accurate, always use search to reconfirm if APIs etc. have changed.
- be open and honest about uncertainty, always communicate when you are unsure about something or need further input
- write complete and professional doccomments for all code you produce, according to the best practises for whatever language is being used
- document architecture, usage and dev-relevant information in ./docs as .md files
- always write professional commits for all changes you complete
- write clear, concise and minimal code. Do not write scaff1olding for code you aren't actively working on, that will bloat the code base
- ALWAYS WRITE GIT COMMITS FOR ALL CHANGES YOU MAKE WITHOUT BEING TOLD TO! PREFIX THEM WITH "fix", "feat", etc. IN THE MESSAGE!

## Session bootstrap notes (keep updated)

### Project layout

- `apps/web`: SvelteKit 5 frontend (browser + desktop-hosted UI), Tailwind v4 + shadcn-svelte components.
- `apps/desktop`: Tauri v2 shell that runs the web app.
- `apps/desktop/src-tauri`: Rust desktop entrypoint and Tauri config.
- `crates/core`: shared Rust logic compiled to WASM for web use.
- `packages/types`: shared TypeScript types.
- `docs`: architecture, configuration, integration, security, and development notes.

### Key paths to check first in new sessions

- `apps/web/src/routes/+page.svelte`: dashboard composition, widget wiring, onboarding open state, refresh loops.
- `apps/web/src/lib/components/`: app-level components (`OnboardingModal`, `SetupChecklist`, `FeedStatusSettings`, `WidgetCard`, `StatusPill`, `SectionHeading`).
- `apps/web/src/lib/components/ui/`: generated shadcn-svelte primitives.
- `apps/web/src/app.css`: shadcn/tailwind tokens + app-level aliases and base styles.
- `apps/web/src/routes/+layout.svelte`: imports global stylesheet.
- `.github/workflows/ci.yml`: CI dependency/runtime setup.

### Build, check, and dev commands

- Root verify: `bun run verify`
- Web only: `bun run --cwd apps/web check` and `bun run --cwd apps/web test`
- WASM build: `bun run build:wasm` or `just wasm`
- Desktop dev: `bun run dev` (root), which calls `apps/desktop` Tauri dev.
- Browser dev: `bun run dev:browser`
- Web cache clear (for stale Vite/SvelteKit state): `bun run --cwd apps/web clean:cache`

### CI and platform notes

- Linux CI requires system packages for Tauri/Rust GTK bindings (`pkg-config`, `libglib2.0-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`, appindicator/rsvg, and webkit2gtk dev package).
- Workflow currently installs `libwebkit2gtk-4.1-dev` when available, otherwise falls back to `libwebkit2gtk-4.0-dev`.

### UI/theming conventions

- Prefer shadcn-svelte primitives in `apps/web/src/lib/components/ui/` over bespoke controls.
- Prefer Lucide icons via `@lucide/svelte`.
- Keep status visuals centralized through shared components (currently `StatusPill.svelte`).
- Reuse shared section title pattern via `SectionHeading.svelte`.

### Open follow-ups (rolling)

- Re-run GitHub Actions CI after workflow dependency updates to confirm glib/webkit package errors are resolved.
- Keep `docs/development.md` and related docs synced whenever workflow/tooling/theming conventions change.

### Recent changes log (session handoff)

Use this section as a lightweight handoff trail. Keep entries short, factual, and newest-first.

Template:

- `YYYY-MM-DD`: `<scope>` — <what changed>.
  - Files: `<path1>`, `<path2>`
  - Verify: `<command>`
  - Follow-up: <next action or `none`>

Example:

- `2026-02-25`: `nextcloud/session-credential-state` — kept Nextcloud app password in onboarding connection state during the active session so save/preflight no longer fail when secure-store reads lag or miss.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`, `bun run --cwd apps/web test`
  - Follow-up: manually verify reconnect flow after full app restart still resolves secure-store password

- `2026-02-25`: `nextcloud/onboarding-state` — moved non-generic CalDAV setup to provider sign-in state, stopped callback autofill fields, and used secure credential-backed connection state for validation/persistence.
  - Files: `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/components/OnboardingModal.svelte`, `apps/web/src/lib/onboarding/validation.ts`, `apps/web/src/lib/settings/user-profile-settings.ts`, `docs/configuration.md`
  - Verify: `bun run --cwd apps/web check`, `bun run --cwd apps/web test`
  - Follow-up: manually verify reconnect status and validation across reopen/reset onboarding flows

- `2026-02-25`: `caldav/providers+secrets` — added provider-based CalDAV onboarding, principal-aware Nextcloud discovery, and OS secure credential storage for desktop.
  - Files: `apps/web/src/lib/components/OnboardingModal.svelte`, `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/adapters/caldav.ts`, `apps/web/src/lib/adapters/caldav.test.ts`, `apps/web/src/lib/adapters/caldav-credentials.ts`, `apps/web/src/lib/onboarding/validation.ts`, `apps/web/src/lib/onboarding/profile-mapping.ts`, `apps/web/src/lib/settings/user-profile-settings.ts`, `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/src-tauri/Cargo.toml`, `docs/configuration.md`
  - Verify: `bun run --cwd apps/web check`, `bun run --cwd apps/web test`, `cargo check`, `cargo test`
  - Follow-up: validate secure-store behavior across Linux Secret Service, macOS Keychain, and Windows Credential Manager

- `2026-02-25`: `desktop/nextcloud-auth` — added Nextcloud Login Flow v2 browser auth handshake and onboarding autofill for CalDAV credentials.
  - Files: `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/src-tauri/Cargo.toml`, `apps/web/src/lib/adapters/nextcloud-login.ts`, `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/components/OnboardingModal.svelte`, `docs/configuration.md`
  - Verify: `bun run --cwd apps/web check`, `bun run --cwd apps/web test`, `cargo test`
  - Follow-up: manually verify end-to-end Nextcloud login flow v2 across local and hosted servers

- `2026-02-25`: `web/settings+coldav` — added settings modal workflow, Nextcloud-friendly login-only CalDAV support, onboarding CalDAV access preflight errors, and stronger dark/system theme handling.
  - Files: `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/components/OnboardingModal.svelte`, `apps/web/src/lib/onboarding/validation.ts`, `apps/web/src/lib/onboarding/profile-mapping.ts`, `apps/web/src/lib/settings/user-profile-settings.ts`, `apps/web/src/lib/adapters/caldav.ts`, `apps/web/src/lib/adapters/caldav.test.ts`, `apps/web/src/lib/adapters/appearance.ts`, `apps/web/src/app.css`, `apps/desktop/src-tauri/src/main.rs`, `docs/configuration.md`
  - Verify: `bun run --cwd apps/web check`, `bun run --cwd apps/web test`, `cargo test`
  - Follow-up: verify Linux desktop runtime against GNOME and KDE portal availability

- `2026-02-25`: `web/appearance` — added persisted appearance settings with system/light/dark mode, Linux portal-backed system detection, and selectable color themes.
  - Files: `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/components/AppearanceSettings.svelte`, `apps/web/src/lib/settings/appearance-settings.ts`, `apps/web/src/lib/adapters/appearance.ts`, `apps/web/src/app.css`, `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/src-tauri/Cargo.toml`, `docs/configuration.md`
  - Verify: `bun run --cwd apps/web check` and `cargo check`
  - Follow-up: validate Linux desktop runtime behavior against portal availability in CI and local environments

- `2026-02-25`: `web/onboarding` — reduced vertical spacing between the step rail panel and form content for a tighter onboarding rhythm.
  - Files: `apps/web/src/lib/components/OnboardingModal.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-25`: `web/onboarding` — adjusted step-panel typography hierarchy to reduce visual crowding in the modal header block.
  - Files: `apps/web/src/lib/components/OnboardingModal.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-25`: `web/onboarding` — shortened step-rail labels while keeping descriptive full titles in the step header.
  - Files: `apps/web/src/lib/components/OnboardingModal.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-25`: `web/onboarding` — fixed step rail layout wrapping by allowing responsive button text flow and widening breakpoints.
  - Files: `apps/web/src/lib/components/OnboardingModal.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-25`: `web/onboarding` — refined the step flow with clickable step rail navigation, guarded forward jumps, and stable footer actions.
  - Files: `apps/web/src/lib/components/OnboardingModal.svelte`, `docs/configuration.md`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-25`: `web/onboarding` — split onboarding modal into a four-step flow with per-step navigation and progress indicators.
  - Files: `apps/web/src/lib/components/OnboardingModal.svelte`, `docs/configuration.md`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `web/notes` — added note-row keyboard shortcuts for open/copy actions with row focus styling.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `web/notes` — added copy-path fallback actions when vault deep links are unavailable.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `web/notes` — added copied-state tinting and centralized copy feedback strings for note link actions.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `web/notes` — added copy-link icon actions with clipboard fallback feedback in notes widget.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `web/notes` — added per-note deep-link copy actions and keyboard focus-visible styles in notes widget controls.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `web/notes` — added per-note Obsidian deep links in the notes widget with compact open actions.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `web/notes` — differentiated pinned and favorite note icon chips with distinct themed accents.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `web/notes` — replaced text note metadata badges with pinned/favorite icon chips in the notes widget.
  - Files: `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: none

- `2026-02-24`: `desktop/tests` — added integration-style vault fixture tests for note ordering and limit behavior.
  - Files: `apps/desktop/src-tauri/src/main.rs`
  - Verify: `cargo test`
  - Follow-up: none

- `2026-02-24`: `desktop/notes` — prioritized pinned/favorite notes in vault indexing order and added Rust unit tests for flag parsing helpers.
  - Files: `apps/desktop/src-tauri/src/main.rs`, `docs/integrations.md`
  - Verify: `cargo test`
  - Follow-up: add integration-style test coverage around `list_recent_notes` ordering with temp vault fixtures

- `2026-02-24`: `notes/integrations` — added pinned/favorite note metadata extraction in desktop Obsidian indexing and surfaced note badges in the web widget.
  - Files: `apps/desktop/src-tauri/src/main.rs`, `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/adapters/obsidian.ts`, `packages/types/src/index.ts`, `docs/integrations.md`
  - Verify: `bun run --cwd apps/web check` and `cargo check`
  - Follow-up: add focused Rust unit tests for frontmatter/tag flag parsing

- `2026-02-24`: `web/ui` — migrated onboarding modal and key controls to shadcn-svelte primitives.
  - Files: `apps/web/src/lib/components/OnboardingModal.svelte`, `apps/web/src/routes/+page.svelte`
  - Verify: `bun run --cwd apps/web check`
  - Follow-up: rerun CI to confirm Linux system dependency fixes
