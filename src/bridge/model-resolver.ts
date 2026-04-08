import { DEFAULT_MODEL_TIERS } from '../config/index.js';
import type { ModelTier, ModelConfig } from '../types/index.js';

export function resolveModel(
  tier: ModelTier,
  unavailable: string[] = [],
  customTiers?: Record<ModelTier, Pick<ModelConfig, 'model' | 'fallback'>>
): string {
  const tiers = customTiers || DEFAULT_MODEL_TIERS;
  const tierConfig = tiers[tier];
  if (!unavailable.includes(tierConfig.model)) return tierConfig.model;
  for (const fallback of tierConfig.fallback) {
    if (!unavailable.includes(fallback)) return fallback;
  }
  throw new Error(`No available model for ${tier}. Primary: ${tierConfig.model}, fallbacks: ${tierConfig.fallback.join(', ')}. All unavailable.`);
}
