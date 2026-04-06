import { z } from 'zod';
import type { OmocConfig, AgentConfig, AgentRole, ModelTier, WorkCategory } from '../types/index.js';

export const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().optional(),
  workingDirectory: z.string().optional()
});

export const ModelConfigSchema = z.object({
  model: z.string(),
  variant: z.string().optional(),
  fallback: z.array(z.string()),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional()
});

export const CategoryConfigSchema = z.object({
  purpose: z.string(),
  defaultTier: z.enum(['tier_1', 'tier_2', 'tier_3', 'multimodal']),
  model: z.string().optional(),
  temperature: z.number().optional(),
  promptAppend: z.string().optional()
});

export const WorkflowConfigSchema = z.object({
  defaultApprovalGate: z.enum(['required', 'auto', 'skip']).default('required'),
  loopMaxIterations: z.number().positive().default(100),
  parallelMaxWorkers: z.number().positive().default(5)
});

export const ConcurrencyConfigSchema = z.object({
  maxParallelWorkers: z.number().positive().default(5),
  maxBackgroundTasks: z.number().positive().default(10),
  perProviderLimit: z.number().positive().default(3),
  perModelLimit: z.number().positive().default(2),
  staleTaskTimeoutSeconds: z.number().positive().default(300)
});

export const CostControlsConfigSchema = z.object({
  sessionBudgetUsd: z.number().nonnegative().default(10.0),
  taskBudgetUsd: z.number().nonnegative().default(3.0),
  alertThresholdPercent: z.number().min(0).max(100).default(75),
  hardStopOnBudget: z.boolean().default(true)
});

export const EventRoutingConfigSchema = z.object({
  channels: z.record(z.string()),
  mentionPolicy: z.record(z.string()),
  suppression: z.record(z.object({
    cooldownSeconds: z.number().optional(),
    interval: z.number().optional()
  })).optional(),
  summaryMode: z.object({
    enabled: z.boolean(),
    batchIntervalSeconds: z.number(),
    batchEvents: z.array(z.string()),
    format: z.string()
  }).optional()
});

export const OmocConfigSchema = z.object({
  $schema: z.string().optional(),
  project: ProjectConfigSchema,
  modelTiers: z.record(ModelConfigSchema),
  agents: z.record(z.any()).optional(),
  categories: z.record(CategoryConfigSchema),
  customCategories: z.record(CategoryConfigSchema).optional(),
  workflows: WorkflowConfigSchema,
  concurrency: ConcurrencyConfigSchema,
  costControls: CostControlsConfigSchema,
  disabledHooks: z.array(z.string()).optional(),
  hookConfig: z.record(z.any()).optional(),
  eventRouting: EventRoutingConfigSchema,
  disabledAgents: z.array(z.string()).optional()
});

export const DEFAULT_MODEL_TIERS: Record<ModelTier, { model: string; variant?: string; fallback: string[] }> = {
  tier_1: {
    model: 'anthropic/claude-opus-4-6',
    variant: 'max',
    fallback: ['openai/gpt-5.4', 'google/gemini-3.1-pro']
  },
  tier_2: {
    model: 'anthropic/claude-sonnet-4-6',
    fallback: ['openai/gpt-5.3-codex', 'google/gemini-3-flash']
  },
  tier_3: {
    model: 'google/gemini-3-flash',
    fallback: ['openai/gpt-5-nano']
  },
  multimodal: {
    model: 'google/gemini-3.1-pro',
    fallback: ['anthropic/claude-opus-4-6']
  }
};

export const DEFAULT_CATEGORIES: Record<WorkCategory, { purpose: string; defaultTier: ModelTier }> = {
  quick: { purpose: 'Simple fixes, searches, small edits', defaultTier: 'tier_3' },
  standard: { purpose: 'Moderate complexity implementations', defaultTier: 'tier_2' },
  deep: { purpose: 'Complex refactoring, multi-file changes', defaultTier: 'tier_1' },
  strategic: { purpose: 'Architecture decisions, root cause analysis', defaultTier: 'tier_1' },
  visual: { purpose: 'UI/UX work, screenshot analysis, PDF review', defaultTier: 'multimodal' },
  research: { purpose: 'Documentation lookup, library investigation', defaultTier: 'tier_3' },
  creative: { purpose: 'Writing, documentation, content generation', defaultTier: 'tier_2' }
};

export function createDefaultConfig(projectName: string, repo: string): OmocConfig {
  return {
    project: {
      name: projectName,
      repo: repo
    },
    modelTiers: DEFAULT_MODEL_TIERS,
    agents: {},
    categories: DEFAULT_CATEGORIES,
    workflows: {
      defaultApprovalGate: 'required',
      loopMaxIterations: 100,
      parallelMaxWorkers: 5
    },
    concurrency: {
      maxParallelWorkers: 5,
      maxBackgroundTasks: 10,
      perProviderLimit: 3,
      perModelLimit: 2,
      staleTaskTimeoutSeconds: 300
    },
    costControls: {
      sessionBudgetUsd: 10.0,
      taskBudgetUsd: 3.0,
      alertThresholdPercent: 75,
      hardStopOnBudget: true
    },
    eventRouting: {
      channels: {
        'agent-status': 'discord:CHANNEL_ID',
        'build-log': 'discord:CHANNEL_ID',
        'alerts': 'discord:CHANNEL_ID'
      },
      mentionPolicy: {
        'alerts': '@USER_ID',
        'plan.ready': '@USER_ID',
        'cost.alert': '@USER_ID'
      }
    }
  };
}

export function validateConfig(config: unknown): { success: true; data: OmocConfig } | { success: false; errors: z.ZodError } {
  const result = OmocConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data as OmocConfig };
  }
  return { success: false, errors: result.error };
}

export function mergeConfig(userConfig: Partial<OmocConfig>, baseConfig: OmocConfig = createDefaultConfig('project', 'repo')): OmocConfig {
  return {
    ...baseConfig,
    ...userConfig,
    project: { ...baseConfig.project, ...userConfig.project },
    modelTiers: { ...baseConfig.modelTiers, ...userConfig.modelTiers },
    categories: { ...baseConfig.categories, ...userConfig.categories },
    workflows: { ...baseConfig.workflows, ...userConfig.workflows },
    concurrency: { ...baseConfig.concurrency, ...userConfig.concurrency },
    costControls: { ...baseConfig.costControls, ...userConfig.costControls },
    eventRouting: { ...baseConfig.eventRouting, ...userConfig.eventRouting }
  };
}
