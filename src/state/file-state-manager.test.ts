import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { FileStateManager } from '../state/file-state-manager.js';
import type { Session, Task, Worker } from '../types/index.js';

const TEST_DIR = '.omoc-test';

describe('FileStateManager', () => {
  let stateManager: FileStateManager;

  beforeEach(() => {
    stateManager = new FileStateManager(TEST_DIR);
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

  test('should create directory structure on initialization', () => {
    expect(existsSync(TEST_DIR)).toBe(true);
    expect(existsSync(join(TEST_DIR, 'state'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'state', 'sessions'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'state', 'tasks'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'state', 'workers'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'plans'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'worktrees'))).toBe(true);
  });

  test('should save and retrieve a session', () => {
    const session: Session = {
      id: 'test-session-1',
      status: 'active',
      mode: 'loop',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [],
      workers: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10.0,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      }
    };

    stateManager.saveSession(session);
    const retrieved = stateManager.getSession('test-session-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('test-session-1');
    expect(retrieved?.status).toBe('active');
  });

  test('should return null for non-existent session', () => {
    const retrieved = stateManager.getSession('non-existent');
    expect(retrieved).toBeNull();
  });

  test('should save and retrieve a task', () => {
    const task: Task = {
      id: 'task-1',
      description: 'Test task',
      category: 'standard',
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      attempts: 1,
      maxAttempts: 3,
      verification: { status: 'pending' },
      dependencies: []
    };

    stateManager.saveTask(task);
    const retrieved = stateManager.getTask('task-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('task-1');
    expect(retrieved?.description).toBe('Test task');
  });

  test('should save and retrieve a worker', () => {
    const worker: Worker = {
      workerId: 'worker-1',
      agent: 'builder',
      sessionId: 'session-1',
      status: 'active',
      lastHeartbeat: new Date().toISOString(),
      commits: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 }
    };

    stateManager.saveWorker(worker);
    const retrieved = stateManager.getWorker('worker-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.workerId).toBe('worker-1');
    expect(retrieved?.agent).toBe('builder');
  });

  test('should list all sessions', () => {
    const session1: Session = {
      id: 'session-1',
      status: 'active',
      mode: 'loop',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [],
      workers: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10.0,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      }
    };

    const session2: Session = {
      id: 'session-2',
      status: 'completed',
      mode: 'run',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      tasks: [],
      workers: [],
      tokenUsage: { input: 100, output: 50, costUsd: 0.5 },
      budget: {
        sessionBudgetUsd: 10.0,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      }
    };

    stateManager.saveSession(session1);
    stateManager.saveSession(session2);

    const sessions = stateManager.listSessions();
    expect(sessions.length).toBe(2);
    expect(sessions.map(s => s.id).sort()).toEqual(['session-1', 'session-2']);
  });

  test('should delete a session', () => {
    const session: Session = {
      id: 'delete-test',
      status: 'active',
      mode: 'loop',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [],
      workers: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10.0,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      }
    };

    stateManager.saveSession(session);
    expect(stateManager.getSession('delete-test')).not.toBeNull();

    stateManager.deleteSession('delete-test');
    expect(stateManager.getSession('delete-test')).toBeNull();
  });
});
