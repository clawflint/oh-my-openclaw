import { randomUUID } from 'crypto';
import type { Task, Worker, Session } from '../types/index.js';

export interface TaskAssignment {
  taskId: string;
  workerId: string;
  agent: string;
  worktree: string;
  branch: string;
}

export interface WorkerHeartbeat {
  workerId: string;
  timestamp: string;
  status: 'idle' | 'working' | 'blocked';
  currentTask?: string;
  progress?: number;
}

export class Foreman {
  private sessionId: string;
  private assignments: Map<string, TaskAssignment> = new Map();
  private heartbeats: Map<string, WorkerHeartbeat> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  createTaskPlan(session: Session): Task[] {
    const tasks = session.tasks;
    
    tasks.forEach(task => {
      if (task.status === 'created') {
        task.status = 'queued';
      }
    });

    return tasks;
  }

  assignTask(task: Task, agent: string): TaskAssignment {
    const workerId = `worker-${randomUUID().slice(0, 8)}`;
    const assignment: TaskAssignment = {
      taskId: task.id,
      workerId,
      agent,
      worktree: `.omoc/worktrees/${workerId}`,
      branch: `omoc/${task.id}`
    };

    this.assignments.set(task.id, assignment);
    
    task.workerId = workerId;
    task.assignedTo = agent as never;
    task.status = 'assigned';
    task.worktree = assignment.worktree;
    task.branch = assignment.branch;

    return assignment;
  }

  updateHeartbeat(workerId: string, status: WorkerHeartbeat['status'], progress?: number): void {
    this.heartbeats.set(workerId, {
      workerId,
      timestamp: new Date().toISOString(),
      status,
      progress
    });
  }

  getHeartbeat(workerId: string): WorkerHeartbeat | undefined {
    return this.heartbeats.get(workerId);
  }

  checkStaleWorkers(timeoutMs: number = 300000): string[] {
    const now = Date.now();
    const stale: string[] = [];

    for (const [workerId, heartbeat] of this.heartbeats) {
      const heartbeatTime = new Date(heartbeat.timestamp).getTime();
      if (now - heartbeatTime > timeoutMs) {
        stale.push(workerId);
      }
    }

    return stale;
  }

  markTaskComplete(task: Task, success: boolean): void {
    if (success) {
      task.status = 'completed';
    } else {
      task.status = 'failed';
      task.attempts++;
      
      if (task.attempts < task.maxAttempts) {
        task.status = 'retrying';
      }
    }

    const assignment = this.assignments.get(task.id);
    if (assignment) {
      this.updateHeartbeat(assignment.workerId, 'idle');
    }
  }

  reassignFailedTask(task: Task): TaskAssignment | null {
    if (task.status !== 'failed' && task.status !== 'retrying') {
      return null;
    }

    const oldAssignment = this.assignments.get(task.id);
    if (oldAssignment) {
      this.heartbeats.delete(oldAssignment.workerId);
      this.assignments.delete(task.id);
    }

    return this.assignTask(task, task.assignedTo || 'builder');
  }

  getNextRunnableTask(tasks: Task[]): Task | null {
    const completedTasks = new Set(tasks.filter(t => t.status === 'completed').map(t => t.id));
    
    for (const task of tasks) {
      if (task.status !== 'queued' && task.status !== 'retrying') continue;
      
      const dependenciesMet = task.dependencies.every(depId => completedTasks.has(depId));
      
      if (dependenciesMet) {
        return task;
      }
    }

    return null;
  }

  calculateProgress(tasks: Task[]): { completed: number; total: number; percentage: number } {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  generateMonitorSnapshot(tasks: Task[], workers: Worker[]): Record<string, unknown> {
    const progress = this.calculateProgress(tasks);
    const activeWorkers = workers.filter(w => w.status === 'active');
    const staleWorkers = this.checkStaleWorkers();

    return {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      progress,
      tasks: {
        total: tasks.length,
        completed: progress.completed,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        queued: tasks.filter(t => t.status === 'queued').length
      },
      workers: {
        total: workers.length,
        active: activeWorkers.length,
        stale: staleWorkers.length
      },
      heartbeats: Array.from(this.heartbeats.values())
    };
  }
}

export function selectAgentForTask(task: Task): string {
  const category = task.category;
  
  const agentMap: Record<string, string> = {
    quick: 'builder',
    standard: 'builder',
    deep: 'architect',
    strategic: 'architect',
    visual: 'observer',
    research: 'researcher',
    creative: 'builder'
  };

  return agentMap[category] || 'builder';
}
