import type {
  DashboardEmailLink,
  DashboardEvent,
  DashboardMonitor,
  DashboardNote,
  DashboardTodo,
  FeedItem
} from '@notedash/types';
import type { DashboardWidget } from './types';

/**
 * Creates static sample data that represents initial adapter output.
 * Replace each group with live integration adapters as they are implemented.
 */
export function buildInitialWidgets(): DashboardWidget[] {
  const agenda: DashboardEvent[] = [
    {
      id: 'event-1',
      title: 'Product check-in',
      startsAtIso: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      endsAtIso: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      source: 'caldav'
    },
    {
      id: 'event-2',
      title: 'Design review',
      startsAtIso: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      endsAtIso: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      source: 'caldav'
    }
  ];

  const todos: DashboardTodo[] = [
    { id: 'todo-1', title: 'Finalize CalDAV adapter shape', done: false, source: 'caldav' },
    { id: 'todo-2', title: 'Wire Obsidian index metadata', done: false, source: 'caldav' }
  ];

  const notes: DashboardNote[] = [
    {
      path: 'daily/2026-02-21.md',
      title: 'Daily Notes',
      updatedAtIso: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    },
    {
      path: 'projects/notedash.md',
      title: 'Notedash Project',
      updatedAtIso: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    }
  ];

  const rss: FeedItem[] = [
    {
      id: 'feed-1',
      title: 'SvelteKit 2.x routing deep dive',
      link: 'https://example.invalid/article',
      source: 'Web Dev Weekly',
      publishedAtIso: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    }
  ];

  const status: DashboardMonitor[] = [
    { id: 'svc-1', name: 'Uptime Kuma', state: 'up', latencyMs: 21 },
    { id: 'svc-2', name: 'Syncthing Relay', state: 'degraded', latencyMs: 179 }
  ];

  const emailLinks: DashboardEmailLink[] = [
    { id: 'mail-1', label: 'Fastmail', href: 'https://app.fastmail.com/' },
    { id: 'mail-2', label: 'Gmail', href: 'https://mail.google.com/' }
  ];

  return [
    { id: 'w-agenda', kind: 'agenda', title: 'Agenda', size: 'large', data: agenda },
    { id: 'w-todos', kind: 'todos', title: 'Tasks', size: 'medium', data: todos },
    { id: 'w-notes', kind: 'notes', title: 'Recent Notes', size: 'medium', data: notes },
    { id: 'w-rss', kind: 'rss', title: 'Feeds', size: 'large', data: rss },
    { id: 'w-status', kind: 'status', title: 'Service Status', size: 'small', data: status },
    {
      id: 'w-email-links',
      kind: 'email-links',
      title: 'Inbox',
      size: 'small',
      data: emailLinks
    }
  ];
}
