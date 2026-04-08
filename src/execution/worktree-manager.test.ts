import { describe, it, expect } from 'vitest';
import { createWorktreeBranch, listWorktrees } from './worktree-manager.js';

describe('createWorktreeBranch', () => {
  it('creates branch name from task and role', () => {
    expect(createWorktreeBranch('task-123', 'builder')).toBe('omoc/builder/task-123');
  });
  it('creates unique branches for different roles', () => {
    const b1 = createWorktreeBranch('task-1', 'builder');
    const b2 = createWorktreeBranch('task-1', 'architect');
    expect(b1).not.toBe(b2);
  });
  it('creates unique branches for different tasks', () => {
    const b1 = createWorktreeBranch('task-1', 'builder');
    const b2 = createWorktreeBranch('task-2', 'builder');
    expect(b1).not.toBe(b2);
  });
});

describe('listWorktrees', () => {
  it('returns array for current repo', () => {
    const result = listWorktrees('/Users/engmsaleh/Repos/oh-my-openclaw');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1); // at least the main worktree
  });
  it('returns empty for nonexistent repo', () => {
    expect(listWorktrees('/nonexistent/path')).toEqual([]);
  });
});
