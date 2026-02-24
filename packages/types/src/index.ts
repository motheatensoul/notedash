/**
 * Represents a calendar event normalized from an external source.
 */
export interface DashboardEvent {
  id: string;
  title: string;
  startsAtIso: string;
  endsAtIso: string;
  source: 'caldav' | 'local';
}

/**
 * Represents a todo item normalized from an external source.
 */
export interface DashboardTodo {
  id: string;
  title: string;
  done: boolean;
  source: 'caldav' | 'local';
}

/**
 * Represents note metadata for a local or synced markdown file.
 */
export interface DashboardNote {
  path: string;
  title: string;
  updatedAtIso: string;
  isPinned?: boolean;
  isFavorite?: boolean;
}

/**
 * Represents an RSS entry normalized into a dashboard-friendly structure.
 */
export interface FeedItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAtIso: string;
}

/**
 * Enumerates status values used for service monitoring cards.
 */
export type MonitorState = 'up' | 'degraded' | 'down';

/**
 * Represents a service monitor status row.
 */
export interface DashboardMonitor {
  id: string;
  name: string;
  state: MonitorState;
  latencyMs?: number;
}

/**
 * Represents a quick link to an email inbox provider.
 */
export interface DashboardEmailLink {
  id: string;
  label: string;
  href: string;
  unread?: number;
}
