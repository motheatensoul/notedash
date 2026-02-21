import type { FeedItem } from '@notedash/types';

/**
 * Defines RSS adapter configuration.
 */
export interface RssAdapterConfig {
  feedUrls: string[];
}

/**
 * Defines the result of an RSS fetch and parse cycle.
 */
export interface RssFetchResult {
  items: FeedItem[];
  errorDetail?: string;
}

/**
 * Fetches and normalizes RSS/Atom feed entries from configured URLs.
 */
export async function fetchRssItems(config: RssAdapterConfig): Promise<FeedItem[]> {
  const result = await fetchRssItemsDetailed(config);
  return result.items;
}

/**
 * Fetches RSS data and returns optional diagnostic detail on failure.
 */
export async function fetchRssItemsDetailed(config: RssAdapterConfig): Promise<RssFetchResult> {
  const urls = config.feedUrls.map((value) => value.trim()).filter(Boolean);
  if (urls.length === 0) {
    return { items: [] };
  }

  const failures: string[] = [];

  const responses = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          failures.push(`${url} (HTTP ${response.status})`);
          return [];
        }

        const body = await response.text();
        const parsed = parseFeedDocument(url, body);
        if (parsed.length === 0) {
          failures.push(`${url} (no parseable items)`);
        }

        return parsed;
      } catch {
        failures.push(`${url} (network error)`);
        return [];
      }
    })
  );

  const items = responses
    .flat()
    .sort((left, right) => right.publishedAtIso.localeCompare(left.publishedAtIso));

  if (items.length > 0) {
    return { items };
  }

  if (failures.length === 0) {
    return { items };
  }

  const joined = failures.slice(0, 2).join('; ');
  const suffix = failures.length > 2 ? '; more sources failed' : '';
  return {
    items,
    errorDetail: `RSS sources failed: ${joined}${suffix}`
  };
}

/**
 * Parses a feed XML payload into normalized dashboard feed items.
 */
function parseFeedDocument(feedUrl: string, xml: string): FeedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  if (doc.querySelector('parsererror')) {
    return [];
  }

  const rssItems = parseRssItems(feedUrl, doc);
  if (rssItems.length > 0) {
    return rssItems;
  }

  return parseAtomEntries(feedUrl, doc);
}

/**
 * Parses RSS channel items from an XML document.
 */
function parseRssItems(feedUrl: string, doc: XMLDocument): FeedItem[] {
  const channelTitle =
    doc.querySelector('rss > channel > title')?.textContent?.trim() ??
    doc.querySelector('channel > title')?.textContent?.trim() ??
    'RSS';

  return [...doc.querySelectorAll('rss > channel > item, channel > item')].map((item, index) => {
    const title = item.querySelector('title')?.textContent?.trim() ?? 'Untitled';
    const link = item.querySelector('link')?.textContent?.trim() ?? feedUrl;
    const guid = item.querySelector('guid')?.textContent?.trim();
    const dateRaw =
      item.querySelector('pubDate')?.textContent?.trim() ??
      item.querySelector('dc\\:date')?.textContent?.trim();

    return {
      id: guid || link || `${feedUrl}#item-${index}`,
      title,
      link,
      source: channelTitle,
      publishedAtIso: normalizeDate(dateRaw)
    };
  });
}

/**
 * Parses Atom feed entries from an XML document.
 */
function parseAtomEntries(feedUrl: string, doc: XMLDocument): FeedItem[] {
  const feedTitle = doc.querySelector('feed > title')?.textContent?.trim() ?? 'Atom';

  return [...doc.querySelectorAll('feed > entry')].map((entry, index) => {
    const title = entry.querySelector('title')?.textContent?.trim() ?? 'Untitled';
    const id = entry.querySelector('id')?.textContent?.trim() ?? `${feedUrl}#entry-${index}`;
    const link =
      entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ??
      entry.querySelector('link')?.getAttribute('href') ??
      feedUrl;
    const dateRaw =
      entry.querySelector('updated')?.textContent?.trim() ??
      entry.querySelector('published')?.textContent?.trim();

    return {
      id,
      title,
      link,
      source: feedTitle,
      publishedAtIso: normalizeDate(dateRaw)
    };
  });
}

/**
 * Converts arbitrary feed dates into stable ISO timestamps.
 */
function normalizeDate(raw: string | undefined): string {
  if (!raw) {
    return new Date(0).toISOString();
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }

  return parsed.toISOString();
}
