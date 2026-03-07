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

  test('merges 24h uptime ratios from heartbeat endpoint', async () => {
    const statusPayload = JSON.stringify({
      publicGroupList: [
        {
          monitorList: [
            { id: 3, name: 'Web', status: 1, ping: 45 },
            { id: 4, name: 'DB', status: 1, ping: 8 }
          ]
        }
      ]
    });
    const heartbeatPayload = JSON.stringify({
      uptimeList: { '3_24': 0.9998, '4_24': 1.0, '3_720': 0.999 }
    });

    let callCount = 0;
    globalThis.fetch = async (url: string | URL | Request) => {
      callCount++;
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/heartbeat/')) {
        return new Response(heartbeatPayload, { status: 200 });
      }
      return new Response(statusPayload, { status: 200 });
    };

    const result = await fetchUptimeKumaStatusDetailed({
      statusPageUrl: 'https://status.example.com/status/main'
    });

    expect(result.monitors.length).toBe(2);
    const web = result.monitors.find((m) => m.name === 'Web')!;
    const db = result.monitors.find((m) => m.name === 'DB')!;
    expect(web.uptimePct).toBeCloseTo(0.9998);
    expect(db.uptimePct).toBeCloseTo(1.0);
    expect(callCount).toBe(2);
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
