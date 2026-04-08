import { describe, it, expect } from 'vitest';
import { prepareCancelPlan, getResumableTasks, prepareResumeActions, DEFAULT_CANCEL_OPTIONS } from './cancel-manager.js';
import type { Session, Task } from '../types/index.js';

function makeTask(id: string, status: string, worktree?: string): Task {
  return {
    id, description: 'test', category: 'quick', status: status as any,
    createdAt: '', attempts: 1, maxAttempts: 3, verification: { status: 'pending' },
    dependencies: [], worktree,
  };
}

function makeSession(tasks: Task[]): Session {
  return {
    id: 'session-1', status: 'active', mode: 'run', createdAt: '', updatedAt: '',
    tasks, workers: [], tokenUsage: { input: 0, output: 0, costUsd: 0 },
    budget: { sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true },
  };
}

describe('prepareCancelPlan', () => {
  it('drains in-progress tasks when drain=true', () => {
    const session = makeSession([makeTask('1', 'in_progress'), makeTask('2', 'queued')]);
    const plan = prepareCancelPlan(session, DEFAULT_CANCEL_OPTIONS);
    expect(plan.toDrain).toHaveLength(1);
    expect(plan.toCancel).toHaveLength(1);
  });
  it('cancels all when drain=false', () => {
    const session = makeSession([makeTask('1', 'in_progress'), makeTask('2', 'queued')]);
    const plan = prepareCancelPlan(session, { ...DEFAULT_CANCEL_OPTIONS, drain: false });
    expect(plan.toDrain).toHaveLength(0);
    expect(plan.toCancel).toHaveLength(2);
  });
  it('collects worktrees for cleanup', () => {
    const session = makeSession([makeTask('1', 'completed', '/tmp/wt1'), makeTask('2', 'in_progress', '/tmp/wt2')]);
    const plan = prepareCancelPlan(session, DEFAULT_CANCEL_OPTIONS);
    expect(plan.toCleanup).toEqual(['/tmp/wt1', '/tmp/wt2']);
  });
  it('skips completed tasks', () => {
    const session = makeSession([makeTask('1', 'completed'), makeTask('2', 'failed')]);
    const plan = prepareCancelPlan(session, DEFAULT_CANCEL_OPTIONS);
    expect(plan.toDrain).toHaveLength(0);
    expect(plan.toCancel).toHaveLength(0);
  });
});

describe('getResumableTasks', () => {
  it('finds interrupted and in-progress tasks', () => {
    const session = makeSession([
      makeTask('1', 'interrupted'),
      makeTask('2', 'in_progress'),
      makeTask('3', 'completed'),
      makeTask('4', 'queued'),
    ]);
    expect(getResumableTasks(session)).toHaveLength(3);
  });
});

describe('prepareResumeActions', () => {
  it('requeues interrupted tasks', () => {
    const session = makeSession([makeTask('1', 'interrupted')]);
    const actions = prepareResumeActions(session);
    expect(actions.toRequeue).toHaveLength(1);
  });
  it('reassigns in-progress tasks', () => {
    const session = makeSession([makeTask('1', 'in_progress')]);
    const actions = prepareResumeActions(session);
    expect(actions.toReassign).toHaveLength(1);
  });
  it('retries failed tasks under max attempts', () => {
    const session = makeSession([makeTask('1', 'failed')]);
    const actions = prepareResumeActions(session);
    expect(actions.toRetry).toHaveLength(1);
  });
  it('does not retry exhausted tasks', () => {
    const task = makeTask('1', 'failed');
    task.attempts = 3;
    const session = makeSession([task]);
    const actions = prepareResumeActions(session);
    expect(actions.toRetry).toHaveLength(0);
  });
});
