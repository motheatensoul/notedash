import { afterEach, describe, expect, test } from 'bun:test';
import { fetchUptimeKumaStatusDetailed } from './uptime-kuma';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchUptimeKumaStatusDetailed', () => {
  test('normalizes grouped monitor payloads', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          publicGroupList: [
            {
              monitorList: [
                { id: 1, name: 'API', status: 1, ping: 23 },
                { id: 2, name: 'Worker', status: 0, ping: 140 }
              ]
            }
          ]
        }),
        { status: 200 }
      );

    const result = await fetchUptimeKumaStatusDetailed({
      statusPageUrl: 'https://status.example.com/status/main'
    });

    expect(result.errorDetail).toBeUndefined();
    expect(result.monitors.length).toBe(2);
    expect(result.monitors[0].name).toBe('API');
    expect(result.monitors[0].state).toBe('up');
    expect(result.monitors[1].state).toBe('down');
  });

  test('returns error detail for failing status endpoints', async () => {
    globalThis.fetch = async () => new Response('server error', { status: 500 });

    const result = await fetchUptimeKumaStatusDetailed({
      statusPageUrl: 'https://status.example.com/status/main'
    });

    expect(result.monitors.length).toBe(0);
    expect(result.errorDetail).toContain('Status endpoint failed');
    expect(result.errorDetail).toContain('HTTP 500');
  });
});
