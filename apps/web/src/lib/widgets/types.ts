import type {
  DashboardEmailLink,
  DashboardEvent,
  DashboardMonitor,
  DashboardNote,
  DashboardTodo,
  FeedItem
} from '@notedash/types';

/**
 * Enumerates the built-in widget identifiers.
 */
export type WidgetKind =
  | 'agenda'
  | 'todos'
  | 'notes'
  | 'rss'
  | 'status'
  | 'email-links';

/**
 * Defines all supported widget payloads.
 */
export interface WidgetDataMap {
  agenda: DashboardEvent[];
  todos: DashboardTodo[];
  notes: DashboardNote[];
  rss: FeedItem[];
  status: DashboardMonitor[];
  'email-links': DashboardEmailLink[];
}

/**
 * Represents a dashboard widget with typed data.
 */
export interface WidgetDefinition<K extends WidgetKind> {
  id: string;
  kind: K;
  title: string;
  size: 'small' | 'medium' | 'large';
  data: WidgetDataMap[K];
}

/**
 * Represents a discriminated union for all concrete widget variants.
 */
export type DashboardWidget = {
  [K in WidgetKind]: WidgetDefinition<K>;
}[WidgetKind];
