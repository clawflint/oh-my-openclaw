import type { Plan, GapAnalysis, PlanReview } from './plan.js';
import { randomUUID } from 'crypto';

export interface AgentExecutionResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly description: string;
  
  protected async simulateExecution(input: string): Promise<AgentExecutionResult> {
    return {
      success: true,
      output: `[${this.name}] Processed: ${input.slice(0, 100)}...`,
      metadata: { agent: this.name, timestamp: new Date().toISOString() }
    };
  }
  
  abstract execute(input: unknown): Promise<AgentExecutionResult>;
}

export class PlannerAgent extends BaseAgent {
  readonly name = 'Planner';
  readonly description = 'Strategic Planner - Interviews user, produces phased plans';
  
  async execute(input: { description: string; context?: string }): Promise<AgentExecutionResult> {
    const { description } = input;

    const phases = this.generatePhases(description);
    
    const result = {
      title: `Implementation Plan: ${description.slice(0, 50)}`,
      description,
      phases
    };
    
    return {
      success: true,
      output: `Created plan with ${phases.length} phases`,
      metadata: { plan: result }
    };
  }
  
  private generatePhases(description: string) {
    const phases = [];
    
    if (description.toLowerCase().includes('implement') || description.toLowerCase().includes('build')) {
      phases.push({
        name: 'Setup & Foundation',
        description: 'Initialize project structure and dependencies',
        tasks: [
          { id: randomUUID(), description: 'Set up project structure', acceptanceCriteria: ['Directory structure created'], estimatedComplexity: 'low', category: 'setup', dependencies: [] },
          { id: randomUUID(), description: 'Install dependencies', acceptanceCriteria: ['All deps installed'], estimatedComplexity: 'low', category: 'setup', dependencies: [] }
        ],
        dependencies: []
      });
    }
    
    phases.push({
      name: 'Implementation',
      description: 'Core feature implementation',
      tasks: [
        { id: randomUUID(), description: 'Implement core functionality', acceptanceCriteria: ['Feature works', 'Tests pass'], estimatedComplexity: 'medium', category: 'implementation', dependencies: [] },
        { id: randomUUID(), description: 'Add error handling', acceptanceCriteria: ['Errors handled gracefully'], estimatedComplexity: 'medium', category: 'implementation', dependencies: [] }
      ],
      dependencies: phases.length > 0 ? [phases[0].name] : []
    });
    
    phases.push({
      name: 'Verification',
      description: 'Testing and validation',
      tasks: [
        { id: randomUUID(), description: 'Write unit tests', acceptanceCriteria: ['Coverage > 80%'], estimatedComplexity: 'medium', category: 'testing', dependencies: [] },
        { id: randomUUID(), description: 'Run integration tests', acceptanceCriteria: ['All tests pass'], estimatedComplexity: 'high', category: 'testing', dependencies: [] }
      ],
      dependencies: [phases[phases.length - 1].name]
    });
    
    return phases;
  }
}

export class AuditorAgent extends BaseAgent {
  readonly name = 'Auditor';
  readonly description = 'Plan Validator - Gap analysis, finds missing context';
  
  async execute(input: { plan: Plan }): Promise<AgentExecutionResult> {
    const { plan } = input;
    
    const gaps: GapAnalysis = {
      criticalGaps: [],
      warnings: [],
      suggestions: [],
      questions: []
    };

    if (!plan.description.includes('error handling')) {
      gaps.warnings.push('Plan may be missing error handling considerations');
    }
    
    if (!plan.description.includes('test')) {
      gaps.warnings.push('Testing strategy not explicitly defined');
    }
    
    if (plan.phases.length < 2) {
      gaps.suggestions.push('Consider breaking work into more phases for better tracking');
    }
    
    const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
    if (totalTasks > 20) {
      gaps.warnings.push(`Large plan (${totalTasks} tasks) - consider splitting into multiple sessions`);
    }
    
    gaps.questions.push('What is the acceptance criteria for overall completion?');
    gaps.questions.push('Are there any external dependencies or blockers?');
    
    return {
      success: true,
      output: `Gap analysis complete: ${gaps.criticalGaps.length} critical, ${gaps.warnings.length} warnings`,
      metadata: { gaps }
    };
  }
}

export class CriticAgent extends BaseAgent {
  readonly name = 'Critic';
  readonly description = 'Plan Reviewer - Challenges plans, surfaces blockers';
  
  async execute(input: { plan: Plan }): Promise<AgentExecutionResult> {
    const { plan } = input;
    
    const review: PlanReview = {
      blockers: [],
      risks: [],
      concerns: [],
      alternatives: []
    };

    const hasHighComplexityTasks = plan.phases.some(p => 
      p.tasks.some(t => t.estimatedComplexity === 'high')
    );
    
    if (hasHighComplexityTasks) {
      review.risks.push('High complexity tasks may exceed time estimates');
    }
    
    const hasManyDependencies = plan.phases.some(p => p.dependencies.length > 2);
    if (hasManyDependencies) {
      review.concerns.push('Complex dependency chain may cause delays');
    }
    
    review.alternatives.push('Consider parallel execution for independent tasks');
    
    if (plan.phases.length > 4) {
      review.concerns.push('Multi-phase plan - monitor for scope creep');
    }
    
    return {
      success: true,
      output: `Review complete: ${review.risks.length} risks, ${review.concerns.length} concerns`,
      metadata: { review }
    };
  }
}

export class PlanningOrchestrator {
  private planner: PlannerAgent;
  private auditor: AuditorAgent;
  private critic: CriticAgent;
  
  constructor() {
    this.planner = new PlannerAgent();
    this.auditor = new AuditorAgent();
    this.critic = new CriticAgent();
  }
  
  async createPlan(description: string, context?: string) {
    const planResult = await this.planner.execute({ description, context });

    if (!planResult.success || !planResult.metadata?.plan) {
      throw new Error('Planner failed to create plan');
    }

    const planBase = planResult.metadata.plan as { title: string; description: string; phases: unknown[] };

    return {
      title: planBase.title,
      description: planBase.description,
      phases: planBase.phases
    };
  }

  async validatePlan(plan: Plan) {
    const auditResult = await this.auditor.execute({ plan });

    const criticResult = await this.critic.execute({ plan });
    
    return {
      gaps: auditResult.metadata?.gaps as GapAnalysis | undefined,
      review: criticResult.metadata?.review as PlanReview | undefined
    };
  }
}

export { PlanningOrchestrator as PlanningLayer };
