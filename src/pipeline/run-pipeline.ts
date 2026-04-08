import type { SubagentBridge, SpawnResult } from '../bridge/subagent-bridge.js';
import { CostTracker } from './cost-tracker.js';
import type { AgentRole, CostControlsConfig } from '../types/index.js';
import { PipelineEventEmitter } from './pipeline-events.js';
import { shouldRequestApproval, formatApprovalRequest } from './approval-gate.js';
import type { ApprovalMode } from './approval-gate.js';

export type { ApprovalMode };

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

export async function runPipeline(
  bridge: SubagentBridge,
  taskDescription: string,
  budget: CostControlsConfig,
  options?: {
    events?: PipelineEventEmitter;
    approvalMode?: ApprovalMode;
    pipelineId?: string;
  }
): Promise<PipelineResult> {
  const costTracker = new CostTracker(budget);
  const stages: StageResult[] = [];
  const pipelineId = options?.pipelineId ?? `pipeline-${Date.now().toString(36)}`;
  const approvalMode = options?.approvalMode ?? 'skip';

  options?.events?.emitPipelineStarted(pipelineId, taskDescription);

  // classify stage
  options?.events?.emitStageStarted(pipelineId, 'classify', 'lead', '');
  const classify = await runStage(bridge, 'classify', 'lead',
    `Classify this task and return JSON: {intent, complexity, plan}.\n\nTask: ${taskDescription}`, costTracker);
  stages.push(classify);
  options?.events?.emitStageCompleted(pipelineId, 'classify', 'lead', classify.durationMs, classify.tokens);

  if (costTracker.isOverBudget()) {
    const totalTokens = stages.reduce((sum, s) => sum + s.tokens.input + s.tokens.output, 0);
    options?.events?.emitPipelineFailed(pipelineId, 'session budget exceeded after classify stage');
    return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after classify stage.', totalTokens, totalCost: costTracker.getTotalCost() };
  }

  // plan stage
  options?.events?.emitStageStarted(pipelineId, 'plan', 'planner', '');
  const plan = await runStage(bridge, 'plan', 'planner',
    `Create a phased implementation plan.\n\nTask: ${taskDescription}\n\nClassification: ${classify.response}`, costTracker);
  stages.push(plan);
  options?.events?.emitStageCompleted(pipelineId, 'plan', 'planner', plan.durationMs, plan.tokens);

  if (costTracker.isOverBudget()) {
    const totalTokens = stages.reduce((sum, s) => sum + s.tokens.input + s.tokens.output, 0);
    options?.events?.emitPipelineFailed(pipelineId, 'session budget exceeded after plan stage');
    return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after plan stage.', totalTokens, totalCost: costTracker.getTotalCost() };
  }

  // Approval gate before build
  if (shouldRequestApproval(approvalMode, 'build')) {
    const approvalMsg = formatApprovalRequest({
      stage: 'plan',
      nextStage: 'build',
      summary: plan.response.substring(0, 200),
      cost: costTracker.getTotalCost(),
    });
    // Approval request included in summary; actual approval handled by caller
    stages.push({ stage: 'approval:build', agent: 'lead', model: '', response: approvalMsg, durationMs: 0, tokens: { input: 0, output: 0 } });
  }

  // build stage
  options?.events?.emitStageStarted(pipelineId, 'build', 'builder', '');
  const build = await runStage(bridge, 'build', 'builder',
    `Execute this plan. Make changes, write tests, commit.\n\nPlan:\n${plan.response}\n\nOriginal task: ${taskDescription}`, costTracker);
  stages.push(build);
  options?.events?.emitStageCompleted(pipelineId, 'build', 'builder', build.durationMs, build.tokens);

  if (costTracker.isOverBudget()) {
    const totalTokens = stages.reduce((sum, s) => sum + s.tokens.input + s.tokens.output, 0);
    options?.events?.emitPipelineFailed(pipelineId, 'session budget exceeded after build stage');
    return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after build stage.', totalTokens, totalCost: costTracker.getTotalCost() };
  }

  // Approval gate before review
  if (shouldRequestApproval(approvalMode, 'review')) {
    const approvalMsg = formatApprovalRequest({
      stage: 'build',
      nextStage: 'review',
      summary: build.response.substring(0, 200),
      cost: costTracker.getTotalCost(),
    });
    stages.push({ stage: 'approval:review', agent: 'lead', model: '', response: approvalMsg, durationMs: 0, tokens: { input: 0, output: 0 } });
  }

  // review stage
  options?.events?.emitStageStarted(pipelineId, 'review', 'reviewer', '');
  const review = await runStage(bridge, 'review', 'reviewer',
    `Review implementation. APPROVED or REJECTED with feedback.\n\nImplementation:\n${build.response}\n\nTask: ${taskDescription}`, costTracker);
  stages.push(review);
  options?.events?.emitStageCompleted(pipelineId, 'review', 'reviewer', review.durationMs, review.tokens);

  const summary = costTracker.getSummary();
  const totalTokens = stages.reduce((sum, s) => sum + s.tokens.input + s.tokens.output, 0);

  options?.events?.emitPipelineCompleted(pipelineId, stages.length, summary.totalCost);

  return {
    status: 'completed', stages, totalTokens, totalCost: summary.totalCost,
    summary: `Pipeline completed: ${stages.length} stages, ${totalTokens} tokens, $${summary.totalCost.toFixed(4)} cost. Review: ${review.response.substring(0, 100)}`,
  };
}
