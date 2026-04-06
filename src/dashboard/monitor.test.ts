import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readdirSync, rmdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { FileStateManager } from '../state/file-state-manager.js';
import { SessionMonitor } from './monitor.js';
import type { Session, Task } from '../types/index.js';

const TEST_DIR = '.omoc-test-dashboard';

describe('SessionMonitor', () => {
  let stateManager: FileStateManager;
  let monitor: SessionMonitor;

  beforeEach(() => {
    stateManager = new FileStateManager(TEST_DIR);
    monitor = new SessionMonitor(stateManager);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      const rmrf = (dir: string) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            rmrf(fullPath);
          } else {
            unlinkSync(fullPath);
          }
        }
        rmdirSync(dir);
      };
      rmrf(TEST_DIR);
    }
  });

  test('should handle unlimited budget without division by zero', () => {
    const session: Session = {
      id: 's1',
      status: 'active',
      mode: 'run',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [],
      workers: [],
      tokenUsage: { input: 100, output: 100, costUsd: 4.2 },
      budget: {
        sessionBudgetUsd: 0,
        taskBudgetUsd: 0,
        alertThresholdPercent: 75,
        hardStopOnBudget: false,
      },
    };
    stateManager.saveSession(session);

    const live = monitor.getLiveSession('s1');
    expect(live).not.toBeNull();
    if (live) {
      expect(live.cost.percentUsed).toBe(0);
    }
  });

  test('should count failed sessions from failed tasks and not from cancelled sessions', () => {
    const now = new Date().toISOString();
    const activeFailed: Session = {
      id: 's-failed',
      status: 'active',
      mode: 'run',
      createdAt: now,
      updatedAt: now,
      tasks: [],
      workers: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10,
        taskBudgetUsd: 3,
        alertThresholdPercent: 75,
        hardStopOnBudget: true,
      },
    };
    const cancelled: Session = {
      id: 's-cancelled',
      status: 'cancelled',
      mode: 'run',
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      tasks: [],
      workers: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10,
        taskBudgetUsd: 3,
        alertThresholdPercent: 75,
        hardStopOnBudget: true,
      },
    };

    const failedTask: Task = {
      id: 't1',
      sessionId: 's-failed',
      description: 'broken task',
      category: 'standard',
      status: 'failed',
      createdAt: now,
      attempts: 1,
      maxAttempts: 3,
      verification: { status: 'failed' },
      dependencies: [],
    };

    stateManager.saveSession(activeFailed);
    stateManager.saveSession(cancelled);
    stateManager.saveTask(failedTask);

    const stats = monitor.getStats();
    expect(stats.failedSessions).toBe(1);
  });
});
