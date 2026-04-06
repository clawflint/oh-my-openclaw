import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import type { Session, Task, Worker, StateManager } from '../types/index.js';

export class FileStateManager implements StateManager {
  private basePath: string;

  constructor(basePath: string = '.omoc') {
    this.basePath = basePath;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      this.basePath,
      join(this.basePath, 'state'),
      join(this.basePath, 'state', 'sessions'),
      join(this.basePath, 'state', 'tasks'),
      join(this.basePath, 'state', 'workers'),
      join(this.basePath, 'plans'),
      join(this.basePath, 'worktrees')
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private readJson<T>(path: string): T | null {
    try {
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  private writeJson(path: string, data: unknown): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2));
  }

  getSession(sessionId: string): Session | null {
    const path = join(this.basePath, 'state', 'sessions', `${sessionId}.json`);
    return this.readJson<Session>(path);
  }

  saveSession(session: Session): void {
    const path = join(this.basePath, 'state', 'sessions', `${session.id}.json`);
    this.writeJson(path, session);
  }

  getTask(taskId: string): Task | null {
    const path = join(this.basePath, 'state', 'tasks', `${taskId}.json`);
    return this.readJson<Task>(path);
  }

  saveTask(task: Task): void {
    const path = join(this.basePath, 'state', 'tasks', `${task.id}.json`);
    this.writeJson(path, task);
  }

  getWorker(workerId: string): Worker | null {
    const path = join(this.basePath, 'state', 'workers', `${workerId}.json`);
    return this.readJson<Worker>(path);
  }

  saveWorker(worker: Worker): void {
    const path = join(this.basePath, 'state', 'workers', `${worker.workerId}.json`);
    this.writeJson(path, worker);
  }

  listSessions(): Session[] {
    const dir = join(this.basePath, 'state', 'sessions');
    if (!existsSync(dir)) return [];
    
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => this.readJson<Session>(join(dir, f)))
      .filter((s): s is Session => s !== null);
  }

  listTasks(sessionId: string): Task[] {
    const dir = join(this.basePath, 'state', 'tasks');
    if (!existsSync(dir)) return [];
    
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => this.readJson<Task>(join(dir, f)))
      .filter((t): t is Task => t !== null && t.sessionId === sessionId);
  }

  listWorkers(sessionId: string): Worker[] {
    const dir = join(this.basePath, 'state', 'workers');
    if (!existsSync(dir)) return [];
    
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => this.readJson<Worker>(join(dir, f)))
      .filter((w): w is Worker => w !== null && w.sessionId === sessionId);
  }

  deleteSession(sessionId: string): void {
    const path = join(this.basePath, 'state', 'sessions', `${sessionId}.json`);
    try {
      unlinkSync(path);
    } catch {}
  }

  deleteTask(taskId: string): void {
    const path = join(this.basePath, 'state', 'tasks', `${taskId}.json`);
    try {
      unlinkSync(path);
    } catch {}
  }

  deleteWorker(workerId: string): void {
    const path = join(this.basePath, 'state', 'workers', `${workerId}.json`);
    try {
      unlinkSync(path);
    } catch {}
  }
}
