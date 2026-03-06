import { describe, expect, test } from 'bun:test';
import { parseEmailProviders, resolveEmailLinks } from './email';

describe('parseEmailProviders', () => {
  test('parses label/url pairs from comma-separated input', () => {
    const parsed = parseEmailProviders(
      'Fastmail|https://app.fastmail.com,Gmail|https://mail.google.com'
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0].label).toBe('Fastmail');
    expect(parsed[1].href).toBe('https://mail.google.com');
  });

  test('ignores empty rows and keeps fallback labels when missing', () => {
    const parsed = parseEmailProviders('  ,  |https://mail.example.com  ');

    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe('Inbox 1');
    expect(parsed[0].href).toBe('https://mail.example.com');
  });
});

describe('resolveEmailLinks', () => {
  test('normalizes labels/urls and deduplicates by id', async () => {
    const resolved = await resolveEmailLinks({
      providers: [
        { id: 'mail', label: ' Fastmail ', href: ' https://app.fastmail.com ' },
        { id: 'mail', label: 'Gmail', href: 'https://mail.google.com' }
      ]
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].id).toBe('mail');
    expect(resolved[0].label).toBe('Gmail');
    expect(resolved[0].href).toBe('https://mail.google.com');
  });

  test('drops providers with missing label or href', async () => {
    const resolved = await resolveEmailLinks({
      providers: [
        { id: 'a', label: '', href: 'https://mail.example.com' },
        { id: 'b', label: 'Mail', href: '' },
        { id: 'c', label: 'Good', href: 'https://mail.good.example.com' }
      ]
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].id).toBe('c');
  });
});
