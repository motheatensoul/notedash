import type { DashboardTodo } from '@notedash/types';
import type { ObsidianTask } from '$lib/adapters/obsidian';

/**
 * Describes the result of diffing CalDAV todos against Obsidian vault tasks.
 */
export interface TaskSyncResult {
  /**
   * Obsidian tasks whose done state differs from the matching CalDAV todo.
   * These are auto-applied (CalDAV is source of truth).
   */
  toUpdateInObsidian: Array<{ task: ObsidianTask; newDone: boolean }>;
  /**
   * Obsidian tasks with no matching CalDAV todo — user is prompted to keep or discard.
   */
  onlyInObsidian: ObsidianTask[];
}

/**
 * Normalizes a task title for fuzzy matching between CalDAV and Obsidian.
 */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Diffs CalDAV todos against Obsidian vault tasks.
 *
 * CalDAV is treated as the source of truth for completion state.
 * Tasks present in Obsidian but not in CalDAV are surfaced for user resolution.
 */
export function diffTasks(
  caldavTodos: DashboardTodo[],
  obsidianTasks: ObsidianTask[]
): TaskSyncResult {
  const caldavByTitle = new Map<string, DashboardTodo>();
  for (const todo of caldavTodos) {
    caldavByTitle.set(normalizeTitle(todo.title), todo);
  }

  const toUpdateInObsidian: TaskSyncResult['toUpdateInObsidian'] = [];
  const onlyInObsidian: ObsidianTask[] = [];

  for (const task of obsidianTasks) {
    const match = caldavByTitle.get(normalizeTitle(task.title));

    if (match) {
      if (task.done !== match.done) {
        toUpdateInObsidian.push({ task, newDone: match.done });
      }
    } else {
      onlyInObsidian.push(task);
    }
  }

  return { toUpdateInObsidian, onlyInObsidian };
}
