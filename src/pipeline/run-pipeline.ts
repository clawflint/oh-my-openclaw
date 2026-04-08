import type { SubagentBridge, SpawnResult } from '../bridge/subagent-bridge.js';
import { CostTracker } from './cost-tracker.js';
import type { AgentRole, CostControlsConfig } from '../types/index.js';

export interface StageResult {
  stage: string;
  agent: AgentRole;
  model: string;
  response: string;
  durationMs: number;
  tokens: { input: number; output: number };
}

export interface PipelineResult {
  status: 'completed' | 'failed';
  stages: StageResult[];
  summary: string;
  totalTokens: number;
  totalCost: number;
}

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4-6': { input: 0.015, output: 0.075 },
  'anthropic/claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'google/gemini-3-flash': { input: 0.0001, output: 0.0004 },
  'google/gemini-3.1-pro': { input: 0.00125, output: 0.005 },
};

function estimateCost(model: string, tokens: { input: number; output: number }): number {
  const rates = COST_PER_1K[model] || { input: 0.003, output: 0.015 };
  return (tokens.input / 1000) * rates.input + (tokens.output / 1000) * rates.output;
}

async function runStage(bridge: SubagentBridge, stageName: string, agent: AgentRole, task: string, costTracker: CostTracker): Promise<StageResult> {
  const start = Date.now();
  const result: SpawnResult = await bridge.spawn(agent, task);
  const durationMs = Date.now() - start;
  const cost = estimateCost(result.model, result.tokens);
  costTracker.recordUsage(agent, { ...result.tokens, costUsd: cost });
  return { stage: stageName, agent, model: result.model, response: result.response, durationMs, tokens: result.tokens };
}

export async function runPipeline(bridge: SubagentBridge, taskDescription: string, budget: CostControlsConfig): Promise<PipelineResult> {
  const costTracker = new CostTracker(budget);
  const stages: StageResult[] = [];

  const classify = await runStage(bridge, 'classify', 'lead',
    `Classify this task and return JSON: {intent, complexity, plan}.\n\nTask: ${taskDescription}`, costTracker);
  stages.push(classify);
  if (costTracker.isOverBudget()) return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after classify stage.', totalTokens: 0, totalCost: costTracker.getTotalCost() };

  const plan = await runStage(bridge, 'plan', 'planner',
    `Create a phased implementation plan.\n\nTask: ${taskDescription}\n\nClassification: ${classify.response}`, costTracker);
  stages.push(plan);
  if (costTracker.isOverBudget()) return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after plan stage.', totalTokens: 0, totalCost: costTracker.getTotalCost() };

  const build = await runStage(bridge, 'build', 'builder',
    `Execute this plan. Make changes, write tests, commit.\n\nPlan:\n${plan.response}\n\nOriginal task: ${taskDescription}`, costTracker);
  stages.push(build);
  if (costTracker.isOverBudget()) return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after build stage.', totalTokens: 0, totalCost: costTracker.getTotalCost() };

  const review = await runStage(bridge, 'review', 'reviewer',
    `Review implementation. APPROVED or REJECTED with feedback.\n\nImplementation:\n${build.response}\n\nTask: ${taskDescription}`, costTracker);
  stages.push(review);

  const summary = costTracker.getSummary();
  const totalTokens = stages.reduce((sum, s) => sum + s.tokens.input + s.tokens.output, 0);

  return {
    status: 'completed', stages, totalTokens, totalCost: summary.totalCost,
    summary: `Pipeline completed: ${stages.length} stages, ${totalTokens} tokens, $${summary.totalCost.toFixed(4)} cost. Review: ${review.response.substring(0, 100)}`,
  };
}
