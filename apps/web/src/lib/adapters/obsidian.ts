import type { DashboardNote } from '@notedash/types';

/**
 * Defines a local vault configuration for desktop mode.
 */
export interface ObsidianAdapterConfig {
  vaultPath: string;
}

/**
 * Lists recent note metadata from an Obsidian vault.
 *
 * In browser mode this returns an empty list until a connector strategy exists.
 */
export async function fetchRecentNotes(_config: ObsidianAdapterConfig): Promise<DashboardNote[]> {
  return [];
}
