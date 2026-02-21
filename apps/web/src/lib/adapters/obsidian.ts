import type { DashboardNote } from '@notedash/types';

/**
 * Defines a local vault configuration for desktop mode.
 */
export interface ObsidianAdapterConfig {
  vaultPath: string;
  limit?: number;
}

/**
 * Represents the payload returned by the desktop note indexing command.
 */
interface NoteMetadata {
  path: string;
  title: string;
  updatedAtIso: string;
}

/**
 * Lists recent note metadata from an Obsidian vault.
 *
 * In browser mode this returns an empty list until a connector strategy exists.
 */
export async function fetchRecentNotes(config: ObsidianAdapterConfig): Promise<DashboardNote[]> {
  const vaultPath = config.vaultPath.trim();
  if (!vaultPath) {
    return [];
  }

  if (!isTauriRuntime()) {
    return [];
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const notes = await invoke<NoteMetadata[]>('list_recent_notes', {
      vaultPath,
      limit: config.limit ?? 12
    });

    return notes.map((note) => ({
      path: note.path,
      title: note.title,
      updatedAtIso: note.updatedAtIso
    }));
  } catch {
    return [];
  }
}

/**
 * Detects whether code is running in a Tauri runtime.
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtime = window as unknown as Record<string, unknown>;
  return '__TAURI__' in runtime || '__TAURI_INTERNALS__' in runtime;
}
