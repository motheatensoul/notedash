set shell := ["bash", "-cu"]

# Build the Rust core crate as a WebAssembly package.
wasm:
    RUSTFLAGS='' CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_LINKER=rust-lld wasm-pack build crates/core --target web --out-dir ../../apps/web/src/lib/wasm

# Build the Rust core crate as WebAssembly with verbose cargo output.
wasm-verbose:
    RUSTFLAGS='' CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_LINKER=rust-lld wasm-pack build crates/core --target web --out-dir ../../apps/web/src/lib/wasm -- -vv

# Start the SvelteKit development server.
web-dev:
    bun run --cwd apps/web dev

# Build the browser application.
web-build:
    bun run --cwd apps/web build

# Run frontend type checks.
web-check:
    bun run --cwd apps/web check

# Run frontend unit tests.
web-test:
    bun run --cwd apps/web test

# Run full validation suite.
verify:
    bun run test:web && bun run check:web && bun run build:wasm && bun run build:web && cargo check --workspace

# Build WebAssembly and then build the web app.
build: wasm web-build
