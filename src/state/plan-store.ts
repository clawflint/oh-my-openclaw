import { readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { atomicWriteSync } from './atomic-write.js';

export interface PlanRecord {
  id: string;
  task: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  stages: Array<{ stage: string; agent: string; model: string; status: string; response?: string }>;
  createdAt: string;
  updatedAt: string;
  cost: number;
}

export class PlanStore {
  private dir: string;

  constructor(baseDir: string = '.omoc/plans') {
    this.dir = baseDir;
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(plan: PlanRecord): void {
    const path = join(this.dir, `${plan.id}.json`);
    atomicWriteSync(path, JSON.stringify(plan, null, 2));
    // Update latest pointer
    atomicWriteSync(join(this.dir, 'latest.json'), JSON.stringify({ id: plan.id, updatedAt: plan.updatedAt }));
  }

  load(id: string): PlanRecord | null {
    const path = join(this.dir, `${id}.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  loadLatest(): PlanRecord | null {
    const latestPath = join(this.dir, 'latest.json');
    if (!existsSync(latestPath)) return null;
    const { id } = JSON.parse(readFileSync(latestPath, 'utf-8'));
    return this.load(id);
  }

  list(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter(f => f.endsWith('.json') && f !== 'latest.json')
      .map(f => f.replace('.json', ''));
  }

  delete(id: string): boolean {
    const path = join(this.dir, `${id}.json`);
    if (!existsSync(path)) return false;
    unlinkSync(path);
    return true;
  }
}
