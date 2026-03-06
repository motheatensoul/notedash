import { afterEach, describe, expect, test } from 'bun:test';
import { fetchRssItemsDetailed } from './rss';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchRssItemsDetailed', () => {
  test('parses RSS items and sorts by publish time descending', async () => {
    globalThis.fetch = async () =>
      new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
         <rss><channel>
           <title>Feed Source</title>
           <item>
             <title>Older</title>
             <link>https://example.com/older</link>
             <pubDate>Wed, 01 Jan 2025 10:00:00 GMT</pubDate>
           </item>
           <item>
             <title>Newer</title>
             <link>https://example.com/newer</link>
             <pubDate>Wed, 01 Jan 2025 11:00:00 GMT</pubDate>
           </item>
         </channel></rss>`,
        { status: 200 }
      );

    const result = await fetchRssItemsDetailed({ feedUrls: ['https://feed.example.com/rss'] });

    if (typeof DOMParser === 'undefined') {
      expect(result.items.length).toBe(0);
      expect(result.errorDetail).toContain('RSS sources failed');
      return;
    }

    expect(result.errorDetail).toBeUndefined();
    expect(result.items.length).toBe(2);
    expect(result.items[0].title).toBe('Newer');
    expect(result.items[1].title).toBe('Older');
    expect(result.items[0].source).toBe('Feed Source');
  });

  test('returns diagnostic details when all feed fetches fail', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('bad-http')) {
        return new Response('not found', { status: 404 });
      }

      throw new Error('network down');
    };

    const result = await fetchRssItemsDetailed({
      feedUrls: ['https://bad-http.example.com/rss', 'https://network-error.example.com/rss']
    });

    expect(result.items.length).toBe(0);
    expect(result.errorDetail).toContain('RSS sources failed');
    expect(result.errorDetail).toContain('bad-http');
  });
});
