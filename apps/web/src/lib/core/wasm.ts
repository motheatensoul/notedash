import type { DashboardEvent, DashboardMonitor } from '@notedash/types';

/**
 * Defines the subset of generated Rust WebAssembly functions used by the app.
 */
interface CoreWasmModule {
  normalize_events: (raw: DashboardEvent[]) => DashboardEvent[];
  normalize_monitors: (raw: DashboardMonitor[]) => DashboardMonitor[];
}

/**
 * Loads the generated `notedash-core` WebAssembly module at runtime.
 *
 * The function returns `null` when the module is not yet built so local UI work
 * can continue before running `just wasm`.
 */
export async function tryLoadCoreWasm(): Promise<CoreWasmModule | null> {
  try {
    const module = await import('$lib/wasm/notedash_core');
    return module as unknown as CoreWasmModule;
  } catch {
    return null;
  }
}
