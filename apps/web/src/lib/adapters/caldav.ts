import type { DashboardEvent, DashboardTodo } from '@notedash/types';

/**
 * Defines CalDAV adapter credentials and endpoint settings.
 */
export interface CaldavAdapterConfig {
  serverUrl: string;
  username: string;
  appPassword: string;
}

/**
 * Defines normalized agenda payload loaded from CalDAV.
 */
export interface CaldavAgendaPayload {
  events: DashboardEvent[];
  todos: DashboardTodo[];
}

/**
 * Provides a read-only CalDAV adapter placeholder for initial wiring.
 */
export async function fetchCaldavAgenda(_config: CaldavAdapterConfig): Promise<CaldavAgendaPayload> {
  return {
    events: [],
    todos: []
  };
}
