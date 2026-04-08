import type { TokenUsage, CostControlsConfig } from '../types/index.js';

interface AgentUsage { input: number; output: number; costUsd: number; }

export interface CostSummary {
  totalCost: number;
  budgetRemaining: number;
  budgetPercent: number;
  agentBreakdown: Array<{ agent: string; cost: number; tokens: { input: number; output: number } }>;
}

export class CostTracker {
  private budget: CostControlsConfig;
  private usage: Map<string, AgentUsage> = new Map();

  constructor(budget: CostControlsConfig) { this.budget = budget; }

  recordUsage(agent: string, tokens: TokenUsage): void {
    const existing = this.usage.get(agent) || { input: 0, output: 0, costUsd: 0 };
    this.usage.set(agent, {
      input: existing.input + tokens.input,
      output: existing.output + tokens.output,
      costUsd: existing.costUsd + tokens.costUsd,
    });
  }

  getTotalCost(): number {
    let total = 0;
    for (const u of this.usage.values()) total += u.costUsd;
    return total;
  }

  getUsageByAgent(agent: string): AgentUsage | undefined { return this.usage.get(agent); }

  isOverBudget(): boolean { return this.budget.hardStopOnBudget && this.getTotalCost() > this.budget.sessionBudgetUsd; }

  isAlertThreshold(): boolean { return (this.getTotalCost() / this.budget.sessionBudgetUsd) * 100 >= this.budget.alertThresholdPercent; }

  getSummary(): CostSummary {
    const totalCost = this.getTotalCost();
    const agentBreakdown: CostSummary['agentBreakdown'] = [];
    for (const [agent, u] of this.usage.entries()) {
      agentBreakdown.push({ agent, cost: u.costUsd, tokens: { input: u.input, output: u.output } });
    }
    return { totalCost, budgetRemaining: this.budget.sessionBudgetUsd - totalCost, budgetPercent: (totalCost / this.budget.sessionBudgetUsd) * 100, agentBreakdown };
  }
}
