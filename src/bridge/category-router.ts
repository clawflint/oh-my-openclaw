import { AGENT_REGISTRY } from '../agents/index.js';
import { resolveModel } from './model-resolver.js';
import type { AgentRole, WorkCategory, ModelTier } from '../types/index.js';

export const CATEGORY_TO_AGENT: Record<string, AgentRole> = {
  quick: 'builder',
  standard: 'builder',
  deep: 'architect',
  strategic: 'planner',
  visual: 'observer',
  research: 'researcher',
  creative: 'builder',
};

export interface RouteResult {
  agent: AgentRole;
  model: string;
  tier: ModelTier;
  persona: string;
}

export function routeCategory(category: WorkCategory, explicitAgent?: AgentRole): RouteResult {
  const agent = explicitAgent || CATEGORY_TO_AGENT[category] || 'builder';
  const agentConfig = AGENT_REGISTRY[agent];
  const tier = agentConfig.defaultTier;
  const model = resolveModel(tier);
  return { agent, model, tier, persona: agentConfig.systemPrompt };
}
