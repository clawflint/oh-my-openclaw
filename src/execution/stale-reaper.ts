import type { StateManager } from '../types/index.js';

export class StaleTaskReaper {
  private stateManager: StateManager;
  private timeoutMs: number;

  constructor(stateManager: StateManager, timeoutMs: number = 300000) {
    this.stateManager = stateManager;
    this.timeoutMs = timeoutMs;
  }

  async checkAndReap(sessionId: string): Promise<{ reaped: number; stale: Array<{ taskId: string; workerId: string }> }> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) return { reaped: 0, stale: [] };

    const tasks = this.stateManager.listTasks(sessionId);
    const workers = this.stateManager.listWorkers(sessionId);
    const stale: Array<{ taskId: string; workerId: string }> = [];

    for (const worker of workers) {
      if (this.isStale(worker.lastHeartbeat)) {
        const task = tasks.find(t => t.workerId === worker.workerId);
        if (task && task.status === 'in_progress') {
          stale.push({ taskId: task.id, workerId: worker.workerId });
        }
      }
    }

    for (const { taskId, workerId } of stale) {
      const task = this.stateManager.getTask(taskId);
      const worker = this.stateManager.getWorker(workerId);

      if (task) {
        task.status = 'failed';
        task.attempts++;
        if (task.attempts < task.maxAttempts) {
          task.status = 'queued';
          task.workerId = undefined;
          task.assignedTo = undefined;
        }
        this.stateManager.saveTask(task);
      }

      if (worker) {
        worker.status = 'stale';
        this.stateManager.saveWorker(worker);
      }
    }

    return { reaped: stale.length, stale };
  }

  async startMonitoring(sessionId: string, intervalMs: number = 60000): Promise<() => void> {
    const interval = setInterval(async () => {
      await this.checkAndReap(sessionId);
    }, intervalMs);

    return () => clearInterval(interval);
  }

  private isStale(lastHeartbeat: string): boolean {
    const last = new Date(lastHeartbeat).getTime();
    const now = Date.now();
    return now - last > this.timeoutMs;
  }
}
