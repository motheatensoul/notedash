import type { DashboardEmailLink } from '@notedash/types';

/**
 * Defines user-configurable inbox shortcuts.
 */
export interface EmailAdapterConfig {
  providers: DashboardEmailLink[];
}

/**
 * Returns configured email links for the dashboard inbox widget.
 */
export async function resolveEmailLinks(config: EmailAdapterConfig): Promise<DashboardEmailLink[]> {
  return config.providers;
}
