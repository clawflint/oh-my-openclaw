export interface PlanPhase {
  name: string;
  description: string;
  tasks: PlanTask[];
  dependencies: string[];
}

export interface PlanTask {
  id: string;
  description: string;
  acceptanceCriteria: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  category: string;
  dependencies: string[];
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  phases: PlanPhase[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  approvalGate: 'required' | 'auto' | 'skip';
  gaps?: GapAnalysis;
  review?: PlanReview;
}

export interface GapAnalysis {
  criticalGaps: string[];
  warnings: string[];
  suggestions: string[];
  questions: string[];
}

export interface PlanReview {
  blockers: string[];
  risks: string[];
  concerns: string[];
  alternatives: string[];
}

export class PlanManager {
  private basePath: string;

  constructor(basePath: string = '.omoc') {
    this.basePath = basePath;
  }

  private getPlanPath(planId: string): string {
    return `${this.basePath}/plans/${planId}.json`;
  }

  private getLatestPlanPath(): string {
    return `${this.basePath}/plans/plan-latest.json`;
  }

  async savePlan(plan: Plan): Promise<void> {
    const { writeFileSync, mkdirSync } = await import('fs');
    const { dirname } = await import('path');
    
    const planPath = this.getPlanPath(plan.id);
    mkdirSync(dirname(planPath), { recursive: true });
    writeFileSync(planPath, JSON.stringify(plan, null, 2));

    const latestPath = this.getLatestPlanPath();
    writeFileSync(latestPath, JSON.stringify(plan, null, 2));
  }

  async loadPlan(planId: string): Promise<Plan | null> {
    const { readFileSync, existsSync } = await import('fs');
    const planPath = this.getPlanPath(planId);
    
    if (!existsSync(planPath)) return null;
    
    try {
      const content = readFileSync(planPath, 'utf-8');
      return JSON.parse(content) as Plan;
    } catch {
      return null;
    }
  }

  async loadLatestPlan(): Promise<Plan | null> {
    const { readFileSync, existsSync } = await import('fs');
    const latestPath = this.getLatestPlanPath();
    
    if (!existsSync(latestPath)) return null;
    
    try {
      const content = readFileSync(latestPath, 'utf-8');
      return JSON.parse(content) as Plan;
    } catch {
      return null;
    }
  }

  async listPlans(): Promise<Plan[]> {
    const { readdirSync, readFileSync, existsSync } = await import('fs');
    const plansDir = `${this.basePath}/plans`;
    
    if (!existsSync(plansDir)) return [];
    
    const files = readdirSync(plansDir).filter(f => f.endsWith('.json') && f !== 'plan-latest.json');
    
    return files
      .map(f => {
        try {
          const content = readFileSync(`${plansDir}/${f}`, 'utf-8');
          return JSON.parse(content) as Plan;
        } catch {
          return null;
        }
      })
      .filter((p): p is Plan => p !== null);
  }
}

export function generatePlanId(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `plan-${timestamp}`;
}

export function createDraftPlan(
  title: string,
  description: string,
  phases: PlanPhase[],
  approvalGate: 'required' | 'auto' | 'skip' = 'required'
): Plan {
  return {
    id: generatePlanId(),
    title,
    description,
    phases,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    approvalGate
  };
}

export function addGapAnalysis(plan: Plan, gaps: GapAnalysis): Plan {
  return {
    ...plan,
    gaps,
    updatedAt: new Date().toISOString()
  };
}

export function addPlanReview(plan: Plan, review: PlanReview): Plan {
  return {
    ...plan,
    review,
    updatedAt: new Date().toISOString()
  };
}

export function approvePlan(plan: Plan): Plan {
  return {
    ...plan,
    status: 'approved',
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function rejectPlan(plan: Plan): Plan {
  return {
    ...plan,
    status: 'rejected',
    updatedAt: new Date().toISOString()
  };
}

export function convertPlanToTasks(plan: Plan): { phaseIndex: number; taskIndex: number; task: PlanTask }[] {
  const tasks: { phaseIndex: number; taskIndex: number; task: PlanTask }[] = [];
  
  plan.phases.forEach((phase, phaseIndex) => {
    phase.tasks.forEach((task, taskIndex) => {
      tasks.push({ phaseIndex, taskIndex, task });
    });
  });
  
  return tasks;
}

export function validatePlan(plan: Plan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!plan.title) errors.push('Plan must have a title');
  if (!plan.description) errors.push('Plan must have a description');
  if (!plan.phases || plan.phases.length === 0) errors.push('Plan must have at least one phase');
  
  plan.phases.forEach((phase, phaseIndex) => {
    if (!phase.name) errors.push(`Phase ${phaseIndex} must have a name`);
    if (!phase.tasks || phase.tasks.length === 0) {
      errors.push(`Phase ${phaseIndex} (${phase.name || 'unnamed'}) must have at least one task`);
    }
    
    phase.tasks.forEach((task, taskIndex) => {
      if (!task.description) {
        errors.push(`Task ${taskIndex} in phase ${phaseIndex} must have a description`);
      }
    });
  });
  
  return { valid: errors.length === 0, errors };
}
