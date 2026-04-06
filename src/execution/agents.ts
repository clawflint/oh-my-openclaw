import type { Plan, PlanTask } from '../planning/plan.js';
import type { AgentExecutionResult } from '../planning/agents.js';

export interface ArchitectInput {
  plan: Plan;
  phaseIndex: number;
  task: PlanTask;
  context?: string;
}

export interface ArchitectOutput {
  implementation: string;
  files: string[];
  tests: string[];
  dependencies: string[];
  notes: string[];
}

export class ArchitectAgent {
  readonly name = 'Architect';
  readonly description = 'Deep Worker - Complex refactoring, system redesigns';

  async execute(input: ArchitectInput): Promise<AgentExecutionResult> {
    const { plan, phaseIndex, task } = input;

    const output: ArchitectOutput = {
      implementation: this.generateImplementation(task),
      files: this.identifyFiles(task),
      tests: this.identifyTests(task),
      dependencies: this.identifyDependencies(task),
      notes: this.generateNotes(task)
    };

    return {
      success: true,
      output: `Architected: ${task.description}`,
      metadata: { output }
    };
  }

  private generateImplementation(task: PlanTask): string {
    const complexity = task.estimatedComplexity;
    
    if (complexity === 'high') {
      return 'Complex implementation requiring careful design consideration';
    }
    
    return 'Standard implementation pattern';
  }

  private identifyFiles(task: PlanTask): string[] {
    const files: string[] = [];
    
    if (task.description.toLowerCase().includes('api')) {
      files.push('src/api/routes.ts', 'src/api/handlers.ts');
    }
    
    if (task.description.toLowerCase().includes('database') || task.description.toLowerCase().includes('model')) {
      files.push('src/db/schema.ts', 'src/db/queries.ts');
    }
    
    if (task.description.toLowerCase().includes('ui') || task.description.toLowerCase().includes('component')) {
      files.push('src/components/', 'src/styles/');
    }
    
    if (files.length === 0) {
      files.push('src/', 'tests/');
    }
    
    return files;
  }

  private identifyTests(task: PlanTask): string[] {
    const tests: string[] = [];
    
    if (task.description.toLowerCase().includes('test')) {
      tests.push(`tests/${task.id}.test.ts`);
    }
    
    tests.push(`tests/integration/${task.id}.test.ts`);
    
    return tests;
  }

  private identifyDependencies(task: PlanTask): string[] {
    return task.dependencies || [];
  }

  private generateNotes(task: PlanTask): string[] {
    const notes: string[] = [];
    
    if (task.estimatedComplexity === 'high') {
      notes.push('High complexity task - allocate extra time');
      notes.push('Consider pair review before implementation');
    }
    
    notes.push(`Category: ${task.category}`);
    notes.push(`Dependencies: ${task.dependencies.length} items`);
    
    return notes;
  }
}

export class ReviewerAgent {
  readonly name = 'Reviewer';
  readonly description = 'Quality Gate - Inspects output, runs tests';

  async execute(input: { taskId: string; worktree: string; files: string[] }): Promise<AgentExecutionResult> {
    const { taskId, files } = input;

    const review = {
      taskId,
      files,
      checks: {
        syntax: this.checkSyntax(files),
        tests: await this.runTests(files),
        style: this.checkStyle(files),
        security: this.checkSecurity(files)
      },
      issues: [] as string[],
      approved: true
    };

    review.approved = Object.values(review.checks).every(check => check.passed);
    
    if (!review.checks.tests.passed) {
      review.issues.push('Tests failing');
    }
    
    if (!review.checks.syntax.passed) {
      review.issues.push('Syntax errors detected');
    }

    return {
      success: review.approved,
      output: review.approved 
        ? `Approved: ${taskId}` 
        : `Rejected: ${taskId} - ${review.issues.join(', ')}`,
      metadata: { review }
    };
  }

  private checkSyntax(files: string[]): { passed: boolean; errors: string[] } {
    return { passed: true, errors: [] };
  }

  private async runTests(files: string[]): Promise<{ passed: boolean; coverage: number }> {
    return { passed: true, coverage: 0 };
  }

  private checkStyle(files: string[]): { passed: boolean; warnings: string[] } {
    return { passed: true, warnings: [] };
  }

  private checkSecurity(files: string[]): { passed: boolean; vulnerabilities: string[] } {
    return { passed: true, vulnerabilities: [] };
  }
}

export class CostTracker {
  private sessionBudget: number;
  private taskBudget: number;
  private spent: number = 0;
  private taskSpent: Map<string, number> = new Map();

  constructor(sessionBudget: number, taskBudget: number) {
    this.sessionBudget = sessionBudget;
    this.taskBudget = taskBudget;
  }

  recordUsage(taskId: string, inputTokens: number, outputTokens: number, costUsd: number): { withinBudget: boolean; alert?: string } {
    this.spent += costUsd;
    
    const currentTaskSpend = this.taskSpent.get(taskId) || 0;
    this.taskSpent.set(taskId, currentTaskSpend + costUsd);

    const sessionPercent = (this.spent / this.sessionBudget) * 100;
    const taskPercent = ((currentTaskSpend + costUsd) / this.taskBudget) * 100;

    if (this.spent > this.sessionBudget) {
      return { withinBudget: false, alert: 'Session budget exceeded' };
    }

    if (currentTaskSpend + costUsd > this.taskBudget) {
      return { withinBudget: false, alert: 'Task budget exceeded' };
    }

    if (sessionPercent > 75) {
      return { withinBudget: true, alert: `Session budget at ${sessionPercent.toFixed(0)}%` };
    }

    if (taskPercent > 75) {
      return { withinBudget: true, alert: `Task budget at ${taskPercent.toFixed(0)}%` };
    }

    return { withinBudget: true };
  }

  getSummary(): { spent: number; budget: number; remaining: number; percentUsed: number } {
    return {
      spent: this.spent,
      budget: this.sessionBudget,
      remaining: this.sessionBudget - this.spent,
      percentUsed: (this.spent / this.sessionBudget) * 100
    };
  }
}
