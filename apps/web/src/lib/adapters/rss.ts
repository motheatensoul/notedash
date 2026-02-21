import type { FeedItem } from '@notedash/types';

/**
 * Defines RSS adapter configuration.
 */
export interface RssAdapterConfig {
  feedUrls: string[];
}

/**
 * Provides a placeholder RSS adapter for initial project wiring.
 *
 * Live feed fetching and parsing are introduced in the next implementation step.
 */
export async function fetchRssItems(_config: RssAdapterConfig): Promise<FeedItem[]> {
  return [];
}
