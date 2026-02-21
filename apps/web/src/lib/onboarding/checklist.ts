/**
 * Defines one setup checklist requirement row.
 */
export interface SetupChecklistItem {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  state: 'ok' | 'warn' | 'todo';
}

/**
 * Defines minimal widget state needed for checklist health summaries.
 */
export interface ChecklistWidgetState {
  rss: 'loading' | 'ok' | 'stale' | 'error';
  status: 'loading' | 'ok' | 'stale' | 'error';
  agenda: 'loading' | 'ok' | 'stale' | 'error';
  todos: 'loading' | 'ok' | 'stale' | 'error';
}

/**
 * Defines checklist data dependencies from profile/runtime/widget state.
 */
export interface ChecklistInput {
  emailLinkCount: number;
  emailLinksRaw: string;
  rssFeedUrls: string;
  uptimeKumaStatusUrl: string;
  caldavCalendarUrl: string;
  obsidianVaultPath: string;
  noteCount: number;
  widgetState: ChecklistWidgetState;
}

/**
 * Builds checklist rows that summarize key onboarding setup completion.
 */
export function buildSetupChecklistItems(input: ChecklistInput): SetupChecklistItem[] {
  const caldavConfigured = input.caldavCalendarUrl.length > 0;
  const caldavHasError = input.widgetState.agenda === 'error' || input.widgetState.todos === 'error';

  return [
    {
      id: 'email',
      label: 'Email links',
      description:
        input.emailLinkCount === 0
          ? input.emailLinksRaw.length > 0
            ? 'Links are configured but format is invalid. Use Label|URL entries.'
            : 'Add at least one inbox link.'
          : 'Inbox shortcuts configured.',
      complete: input.emailLinkCount > 0,
      state: input.emailLinkCount > 0 ? 'ok' : input.emailLinksRaw.length > 0 ? 'warn' : 'todo'
    },
    {
      id: 'rss',
      label: 'RSS feeds',
      description:
        input.rssFeedUrls.length === 0
          ? 'Add one or more RSS source URLs.'
          : input.widgetState.rss === 'error'
            ? 'Configured, but the last refresh failed.'
            : 'Feed sources configured and refreshing.',
      complete: input.rssFeedUrls.length > 0 && input.widgetState.rss !== 'error',
      state: input.rssFeedUrls.length === 0 ? 'todo' : input.widgetState.rss === 'error' ? 'warn' : 'ok'
    },
    {
      id: 'status',
      label: 'Service status',
      description:
        input.uptimeKumaStatusUrl.length === 0
          ? 'Add a Uptime Kuma status URL.'
          : input.widgetState.status === 'error'
            ? 'Configured, but the last status refresh failed.'
            : 'Uptime Kuma URL configured and refreshing.',
      complete: input.uptimeKumaStatusUrl.length > 0 && input.widgetState.status !== 'error',
      state:
        input.uptimeKumaStatusUrl.length === 0
          ? 'todo'
          : input.widgetState.status === 'error'
            ? 'warn'
            : 'ok'
    },
    {
      id: 'notes',
      label: 'Obsidian notes',
      description:
        input.obsidianVaultPath.length === 0
          ? 'Add a desktop vault path for note indexing.'
          : input.noteCount > 0
            ? 'Vault path configured and notes detected.'
            : 'Vault path configured. No notes detected yet.',
      complete: input.obsidianVaultPath.length > 0 && input.noteCount > 0,
      state: input.obsidianVaultPath.length === 0 ? 'todo' : input.noteCount > 0 ? 'ok' : 'warn'
    },
    {
      id: 'caldav',
      label: 'CalDAV agenda',
      description:
        !caldavConfigured
          ? 'Add a CalDAV calendar collection URL.'
          : caldavHasError
            ? 'Configured, but the last CalDAV refresh failed.'
            : 'Calendar URL configured and refreshing.',
      complete: caldavConfigured && !caldavHasError,
      state: !caldavConfigured ? 'todo' : caldavHasError ? 'warn' : 'ok'
    }
  ];
}
