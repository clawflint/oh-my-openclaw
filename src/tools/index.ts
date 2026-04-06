import type { 
  WorkCategory, 
  ModelTier, 
  AgentRole, 
  AgentConfig
} from '../types/index.js';
import { AGENT_REGISTRY } from '../agents/registry.js';
import { DEFAULT_MODEL_TIERS, DEFAULT_CATEGORIES } from '../config/index.js';

export interface DelegationResult {
  agent: AgentRole;
  model: string;
  config: AgentConfig;
}

export function resolveCategoryToModel(category: WorkCategory): { tier: ModelTier; model: string } {
  const categoryConfig = DEFAULT_CATEGORIES[category];
  if (!categoryConfig) {
    return { tier: 'tier_2', model: DEFAULT_MODEL_TIERS.tier_2.model };
  }

  const tier = categoryConfig.defaultTier;
  const modelConfig = DEFAULT_MODEL_TIERS[tier];
  
  return { tier, model: modelConfig.model };
}

export function delegateByCategory(
  category: WorkCategory,
  preferAgent?: AgentRole
): DelegationResult {
  const { model } = resolveCategoryToModel(category);
  
  let agent: AgentRole;
  if (preferAgent && canHandleCategory(preferAgent, category)) {
    agent = preferAgent;
  } else {
    agent = selectAgentForCategory(category);
  }

  const config = AGENT_REGISTRY[agent];
  
  return { agent, model, config };
}

function canHandleCategory(agent: AgentRole, category: WorkCategory): boolean {
  const categoryAgentMap: Record<WorkCategory, AgentRole[]> = {
    quick: ['builder', 'scout'],
    standard: ['builder', 'architect'],
    deep: ['architect', 'builder'],
    strategic: ['architect', 'lead'],
    visual: ['observer', 'builder'],
    research: ['researcher', 'scout'],
    creative: ['builder', 'architect']
  };

  const preferredAgents = categoryAgentMap[category] || ['builder'];
  return preferredAgents.includes(agent);
}

function selectAgentForCategory(category: WorkCategory): AgentRole {
  const categoryAgentMap: Record<WorkCategory, AgentRole[]> = {
    quick: ['builder', 'scout'],
    standard: ['builder', 'architect'],
    deep: ['architect', 'builder'],
    strategic: ['architect', 'lead'],
    visual: ['observer', 'builder'],
    research: ['researcher', 'scout'],
    creative: ['builder', 'architect']
  };

  const preferredAgents = categoryAgentMap[category] || ['builder'];
  return preferredAgents[0];
}

export function createDelegationTool() {
  return {
    name: 'delegate',
    description: 'Category-based task delegation with model routing',
    execute: (category: WorkCategory, _taskDescription: string, preferAgent?: AgentRole): DelegationResult => {
      return delegateByCategory(category, preferAgent);
    }
  };
}

export function createSummonTool() {
  return {
    name: 'summon',
    description: 'Direct agent invocation by name',
    execute: (agent: AgentRole, _taskDescription: string): DelegationResult => {
      const config = AGENT_REGISTRY[agent];
      const { model } = resolveCategoryToModel(config.defaultTier === 'tier_1' ? 'deep' : 'standard');
      
      return { agent, model, config };
    }
  };
}

type CheckpointAction = 'save' | 'load' | 'list';

type CheckpointResult =
  | { saved: true; checkpointId: string }
  | { loaded: true; checkpointId?: string }
  | { checkpoints: string[] }
  | { error: string };

export function createCheckpointTool() {
  return {
    name: 'checkpoint',
    description: 'Save/load/list execution checkpoints',
    execute: (action: CheckpointAction, checkpointId?: string): CheckpointResult => {
      switch (action) {
        case 'save':
          return { saved: true, checkpointId: `cp-${Date.now()}` };
        case 'load':
          return { loaded: true, checkpointId };
        case 'list':
          return { checkpoints: [] };
        default:
          return { error: 'Invalid action' };
      }
    }
  };
}
