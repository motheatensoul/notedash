import { describe, expect, test } from 'bun:test';
import { diffTasks } from './task-sync';
import type { DashboardTodo } from '@notedash/types';
import type { ObsidianTask } from '$lib/adapters/obsidian';

/**
 * Minimal DashboardTodo factory.
 */
function caldavTodo(title: string, done: boolean): DashboardTodo {
  return { id: crypto.randomUUID(), title, done, source: 'caldav' };
}

/**
 * Minimal ObsidianTask factory.
 */
function vaultTask(title: string, done: boolean, line = 0): ObsidianTask {
  return { filePath: 'notes/tasks.md', lineNumber: line, title, done };
}

describe('diffTasks', () => {
  test('returns empty result when both lists are empty', () => {
    const result = diffTasks([], []);
    expect(result.toUpdateInObsidian).toHaveLength(0);
    expect(result.onlyInObsidian).toHaveLength(0);
  });

  test('tasks only in CalDAV produce no output', () => {
    const result = diffTasks([caldavTodo('Buy milk', false)], []);
    expect(result.toUpdateInObsidian).toHaveLength(0);
    expect(result.onlyInObsidian).toHaveLength(0);
  });

  test('tasks only in Obsidian go into onlyInObsidian', () => {
    const task = vaultTask('Write report', false);
    const result = diffTasks([], [task]);
    expect(result.onlyInObsidian).toHaveLength(1);
    expect(result.onlyInObsidian[0]).toBe(task);
    expect(result.toUpdateInObsidian).toHaveLength(0);
  });

  test('matching tasks with same done state are ignored', () => {
    const result = diffTasks(
      [caldavTodo('Buy milk', false)],
      [vaultTask('Buy milk', false)]
    );
    expect(result.toUpdateInObsidian).toHaveLength(0);
    expect(result.onlyInObsidian).toHaveLength(0);
  });

  test('matching tasks with differing done state go into toUpdateInObsidian', () => {
    const task = vaultTask('Buy milk', false);
    const result = diffTasks([caldavTodo('Buy milk', true)], [task]);
    expect(result.toUpdateInObsidian).toHaveLength(1);
    expect(result.toUpdateInObsidian[0].task).toBe(task);
    expect(result.toUpdateInObsidian[0].newDone).toBe(true);
    expect(result.onlyInObsidian).toHaveLength(0);
  });

  test('newDone reflects CalDAV state when Obsidian has task marked done but CalDAV does not', () => {
    const task = vaultTask('Submit invoice', true);
    const result = diffTasks([caldavTodo('Submit invoice', false)], [task]);
    expect(result.toUpdateInObsidian[0].newDone).toBe(false);
  });

  test('matching is case-insensitive and trims whitespace', () => {
    const task = vaultTask('  BUY MILK  ', false);
    const result = diffTasks([caldavTodo('buy milk', true)], [task]);
    expect(result.toUpdateInObsidian).toHaveLength(1);
    expect(result.toUpdateInObsidian[0].newDone).toBe(true);
  });

  test('matching collapses internal whitespace', () => {
    const task = vaultTask('buy  extra   milk', false);
    const result = diffTasks([caldavTodo('buy extra milk', true)], [task]);
    expect(result.toUpdateInObsidian).toHaveLength(1);
  });

  test('handles multiple tasks with mixed outcomes', () => {
    const caldav = [
      caldavTodo('Task A', true),
      caldavTodo('Task B', false)
    ];
    const obsidian = [
      vaultTask('Task A', false, 0),  // differs → toUpdate
      vaultTask('Task B', false, 1),  // same → ignored
      vaultTask('Task C', false, 2)   // no match → onlyInObsidian
    ];

    const result = diffTasks(caldav, obsidian);
    expect(result.toUpdateInObsidian).toHaveLength(1);
    expect(result.toUpdateInObsidian[0].task.title).toBe('Task A');
    expect(result.toUpdateInObsidian[0].newDone).toBe(true);
    expect(result.onlyInObsidian).toHaveLength(1);
    expect(result.onlyInObsidian[0].title).toBe('Task C');
  });
});
