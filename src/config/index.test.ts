import { describe, test, expect } from 'bun:test';
import { 
  validateConfig, 
  createDefaultConfig, 
  mergeConfig,
  DEFAULT_MODEL_TIERS,
  DEFAULT_CATEGORIES 
} from './index.js';

describe('Config Validation', () => {
  test('should validate a valid config', () => {
    const config = createDefaultConfig('Test Project', 'github.com/test/repo');
    const result = validateConfig(config);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project.name).toBe('Test Project');
    }
  });

  test('should reject config without project', () => {
    const result = validateConfig({});
    expect(result.success).toBe(false);
  });

  test('should reject config with invalid model tiers', () => {
    const config = createDefaultConfig('Test', 'repo');
    ((config as unknown) as Record<string, unknown>).modelTiers = 'invalid';
    
    const result = validateConfig(config);
    expect(result.success).toBe(false);
  });

  test('should create default config with correct structure', () => {
    const config = createDefaultConfig('My Project', 'github.com/user/repo');
    
    expect(config.project.name).toBe('My Project');
    expect(config.project.repo).toBe('github.com/user/repo');
    expect(config.workflows.loopMaxIterations).toBe(100);
    expect(config.concurrency.maxParallelWorkers).toBe(5);
    expect(config.costControls.sessionBudgetUsd).toBe(10.0);
  });

  test('should merge user config with defaults', () => {
    const baseConfig = createDefaultConfig('Base', 'repo');
    const userConfig = {
      project: { name: 'Updated' },
      workflows: { loopMaxIterations: 50 }
    };
    
    const merged = mergeConfig((userConfig as unknown) as Partial<typeof baseConfig>, baseConfig);
    
    expect(merged.project.name).toBe('Updated');
    expect(merged.project.repo).toBe('repo');
    expect(merged.workflows.loopMaxIterations).toBe(50);
    expect(merged.workflows.parallelMaxWorkers).toBe(5);
  });

  test('should preserve default values not in user config', () => {
    const baseConfig = createDefaultConfig('Base', 'repo');
    const userConfig = { project: { name: 'New' } };
    
    const merged = mergeConfig((userConfig as unknown) as Partial<typeof baseConfig>, baseConfig);
    
    expect(merged.costControls.sessionBudgetUsd).toBe(10.0);
    expect(merged.concurrency.maxParallelWorkers).toBe(5);
  });
});

describe('Default Model Tiers', () => {
  test('should have tier_1 configuration', () => {
    expect(DEFAULT_MODEL_TIERS.tier_1.model).toBe('anthropic/claude-opus-4-6');
    expect(DEFAULT_MODEL_TIERS.tier_1.fallback.length).toBeGreaterThan(0);
  });

  test('should have tier_2 configuration', () => {
    expect(DEFAULT_MODEL_TIERS.tier_2.model).toBe('anthropic/claude-sonnet-4-6');
    expect(DEFAULT_MODEL_TIERS.tier_2.fallback.length).toBeGreaterThan(0);
  });

  test('should have tier_3 configuration', () => {
    expect(DEFAULT_MODEL_TIERS.tier_3.model).toBe('google/gemini-3-flash');
    expect(DEFAULT_MODEL_TIERS.tier_3.fallback.length).toBeGreaterThan(0);
  });

  test('should have multimodal configuration', () => {
    expect(DEFAULT_MODEL_TIERS.multimodal.model).toBe('google/gemini-3.1-pro');
    expect(DEFAULT_MODEL_TIERS.multimodal.fallback.length).toBeGreaterThan(0);
  });
});

describe('Default Categories', () => {
  test('should have quick category with tier_3', () => {
    expect(DEFAULT_CATEGORIES.quick.defaultTier).toBe('tier_3');
  });

  test('should have standard category with tier_2', () => {
    expect(DEFAULT_CATEGORIES.standard.defaultTier).toBe('tier_2');
  });

  test('should have deep category with tier_1', () => {
    expect(DEFAULT_CATEGORIES.deep.defaultTier).toBe('tier_1');
  });

  test('should have strategic category with tier_1', () => {
    expect(DEFAULT_CATEGORIES.strategic.defaultTier).toBe('tier_1');
  });

  test('should have visual category with multimodal', () => {
    expect(DEFAULT_CATEGORIES.visual.defaultTier).toBe('multimodal');
  });

  test('should have research category with tier_3', () => {
    expect(DEFAULT_CATEGORIES.research.defaultTier).toBe('tier_3');
  });

  test('should have creative category with tier_2', () => {
    expect(DEFAULT_CATEGORIES.creative.defaultTier).toBe('tier_2');
  });
});
