set shell := ["bash", "-cu"]

# Build the Rust core crate as a WebAssembly package.
wasm:
    wasm-pack build crates/core --target web --out-dir ../../apps/web/src/lib/wasm

# Start the SvelteKit development server.
web-dev:
    bun run --cwd apps/web dev

# Build the browser application.
web-build:
    bun run --cwd apps/web build

# Run frontend type checks.
web-check:
    bun run --cwd apps/web check

# Build WebAssembly and then build the web app.
build: wasm web-build
