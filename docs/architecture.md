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

## Capability differences

- Desktop mode can read local vault files and use secure credential storage.
- Browser mode uses network-only adapters unless a connector service is later introduced.

## WASM boundary

Rust code in `crates/core` owns:

- Shared domain data shapes.
- Timestamp ordering and normalization helpers.
- Cross-integration utility logic.

Frontend code consumes the generated WASM package and applies thin TypeScript wrappers.
