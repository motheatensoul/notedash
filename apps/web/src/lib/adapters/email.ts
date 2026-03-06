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
  const normalized = new Map<string, DashboardEmailLink>();

  for (const provider of config.providers) {
    const label = provider.label?.trim();
    const href = provider.href?.trim();
    if (!label || !href) {
      continue;
    }

    const id = provider.id?.trim() || label.toLowerCase().replace(/\s+/g, '-');
    normalized.set(id, {
      id,
      label,
      href,
      unread: provider.unread
    });
  }

  return [...normalized.values()];
}

/**
 * Parses a comma-separated email source list into link providers.
 *
 * Expected format: `Label|https://url,Other Label|https://url`.
 */
export function parseEmailProviders(raw: string): DashboardEmailLink[] {
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [labelPart, hrefPart] = entry.split('|').map((value) => value.trim());
      const label = labelPart || `Inbox ${index + 1}`;
      const href = hrefPart || '';

      return {
        id: `email-${index}`,
        label,
        href
      };
    })
    .filter((provider) => provider.href.length > 0);
}
