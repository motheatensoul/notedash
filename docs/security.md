# Security

## Secrets and authentication

- Desktop mode stores credentials using OS-backed secure storage.
- Browser mode must avoid writing raw credentials to local storage.
- Token-bearing integrations should be disabled in browser mode until a connector service is added.

## Network safety

- Integrations should use explicit host allow-lists where feasible.
- UI must clearly mark stale data and network failures.
- Adapter error messages should avoid exposing raw secrets or tokens.

## Filesystem access

- Obsidian vault support is read-only in this initial stage.
- Future write operations must include explicit user confirmation and scoped path validation.
