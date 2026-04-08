import { AGENT_REGISTRY } from '../agents/index.js';
import type { AgentRole, ModelTier } from '../types/index.js';
import { DEFAULT_MODEL_TIERS } from '../config/index.js';

export interface FallbackResult {
  model: string;
  attempt: number;
  success: boolean;
  error?: string;
}

export async function executeWithFallback<T>(
  tier: ModelTier,
  execute: (model: string) => Promise<T>,
  maxAttempts: number = 3
): Promise<{ result: T; fallbackInfo: FallbackResult }> {
  const tierConfig = DEFAULT_MODEL_TIERS[tier];
  const allModels = [tierConfig.model, ...tierConfig.fallback];
  const tried: string[] = [];

  for (let i = 0; i < Math.min(maxAttempts, allModels.length); i++) {
    const model = allModels[i];
    tried.push(model);
    try {
      const result = await execute(model);
      return {
        result,
        fallbackInfo: { model, attempt: i + 1, success: true },
      };
    } catch (err) {
      if (i === Math.min(maxAttempts, allModels.length) - 1) {
        throw new Error(`All ${tried.length} models failed for ${tier}. Tried: ${tried.join(', ')}. Last error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  throw new Error(`No models available for ${tier}`);
}

export function getModelChain(tier: ModelTier): string[] {
  const config = DEFAULT_MODEL_TIERS[tier];
  return [config.model, ...config.fallback];
}

export function getAgentModelChain(role: AgentRole): string[] {
  const agent = AGENT_REGISTRY[role];
  return getModelChain(agent.defaultTier);
}
