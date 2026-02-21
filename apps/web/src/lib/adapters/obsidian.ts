import type { DashboardNote } from '@notedash/types';

/**
 * Defines a local vault configuration for desktop mode.
 */
export interface ObsidianAdapterConfig {
  vaultPath: string;
  limit?: number;
}

/**
 * Defines note adapter output with optional diagnostics.
 */
export interface ObsidianFetchResult {
  notes: DashboardNote[];
  errorDetail?: string;
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
  const result = await fetchRecentNotesDetailed(config);
  return result.notes;
}

/**
 * Lists recent note metadata with optional diagnostics.
 */
export async function fetchRecentNotesDetailed(
  config: ObsidianAdapterConfig
): Promise<ObsidianFetchResult> {
  const vaultPath = config.vaultPath.trim();
  if (!vaultPath) {
    return { notes: [] };
  }

  if (!isTauriRuntime()) {
    return {
      notes: [],
      errorDetail: 'Desktop runtime required for vault indexing'
    };
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const notes = await invoke<NoteMetadata[]>('list_recent_notes', {
      vaultPath,
      limit: config.limit ?? 12
    });

    const mapped = notes.map((note) => ({
      path: note.path,
      title: note.title,
      updatedAtIso: note.updatedAtIso
    }));

    if (mapped.length === 0) {
      return {
        notes: [],
        errorDetail: 'Vault path is configured but no markdown notes were found'
      };
    }

    return { notes: mapped };
  } catch {
    return {
      notes: [],
      errorDetail: 'Failed to read vault path from desktop command'
    };
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
