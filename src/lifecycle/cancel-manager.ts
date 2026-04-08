// src/lifecycle/cancel-manager.ts
import type { Session, Task, TaskStatus } from '../types/index.js';

export interface CancelOptions {
  drain: boolean;       // Wait for in-progress tasks to finish
  drainTimeoutMs: number;
  revert: boolean;      // Revert uncommitted changes
  cleanup: boolean;     // Remove worktrees
}

export const DEFAULT_CANCEL_OPTIONS: CancelOptions = {
  drain: true,
  drainTimeoutMs: 120000,
  revert: false,
  cleanup: true,
};

export interface CancelResult {
  sessionId: string;
  cancelledTasks: string[];
  drainedTasks: string[];
  failedDrains: string[];
  cleanedWorktrees: number;
  reverted: boolean;
}

export function prepareCancelPlan(session: Session, options: CancelOptions): {
  toDrain: Task[];
  toCancel: Task[];
  toCleanup: string[];
} {
  const toDrain: Task[] = [];
  const toCancel: Task[] = [];
  const toCleanup: string[] = [];

  for (const task of session.tasks) {
    if (task.status === 'in_progress' && options.drain) {
      toDrain.push(task);
    } else if (['queued', 'assigned', 'in_progress', 'verifying'].includes(task.status)) {
      toCancel.push(task);
    }
    if (task.worktree && options.cleanup) {
      toCleanup.push(task.worktree);
    }
  }

  return { toDrain, toCancel, toCleanup };
}

export function getResumableTasks(session: Session): Task[] {
  return session.tasks.filter(t =>
    t.status === 'in_progress' ||
    t.status === 'assigned' ||
    t.status === 'queued' ||
    t.status === 'interrupted'
  );
}

export function prepareResumeActions(session: Session): {
  toRequeue: Task[];
  toReassign: Task[];
  toRetry: Task[];
} {
  const toRequeue: Task[] = [];
  const toReassign: Task[] = [];
  const toRetry: Task[] = [];

  for (const task of session.tasks) {
    switch (task.status) {
      case 'interrupted':
        toRequeue.push(task);
        break;
      case 'in_progress':
        // Was running when session paused — reassign
        toReassign.push(task);
        break;
      case 'failed':
      case 'rejected':
        if (task.attempts < task.maxAttempts) {
          toRetry.push(task);
        }
        break;
    }
  }

  return { toRequeue, toReassign, toRetry };
}
