import { describe, it, expect } from 'vitest';
import { CostTracker } from './cost-tracker.js';

describe('CostTracker', () => {
  it('starts with zero usage', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true });
    expect(tracker.getTotalCost()).toBe(0);
    expect(tracker.isOverBudget()).toBe(false);
  });
  it('tracks token usage and estimates cost', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true });
    tracker.recordUsage('builder', { input: 1000, output: 500, costUsd: 0.005 });
    expect(tracker.getTotalCost()).toBe(0.005);
    expect(tracker.getUsageByAgent('builder')).toEqual({ input: 1000, output: 500, costUsd: 0.005 });
  });
  it('detects budget exceeded when hardStop is true', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 0.01, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true });
    tracker.recordUsage('builder', { input: 100000, output: 50000, costUsd: 0.02 });
    expect(tracker.isOverBudget()).toBe(true);
  });
  it('detects alert threshold', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 1.0, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: false });
    tracker.recordUsage('architect', { input: 50000, output: 25000, costUsd: 0.80 });
    expect(tracker.isAlertThreshold()).toBe(true);
    expect(tracker.isOverBudget()).toBe(false);
  });
  it('returns summary report', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true });
    tracker.recordUsage('lead', { input: 500, output: 200, costUsd: 0.01 });
    tracker.recordUsage('builder', { input: 2000, output: 1000, costUsd: 0.03 });
    const summary = tracker.getSummary();
    expect(summary.totalCost).toBe(0.04);
    expect(summary.agentBreakdown).toHaveLength(2);
    expect(summary.budgetRemaining).toBe(9.96);
  });
});
