import { describe, test, expect } from 'bun:test';
import { 
  resolveCategoryToModel, 
  delegateByCategory,
  createDelegationTool,
  createSummonTool,
  createCheckpointTool
} from './index.js';

describe('Category to Model Resolution', () => {
  test('should resolve quick category to tier_3', () => {
    const result = resolveCategoryToModel('quick');
    expect(result.tier).toBe('tier_3');
  });

  test('should resolve standard category to tier_2', () => {
    const result = resolveCategoryToModel('standard');
    expect(result.tier).toBe('tier_2');
  });

  test('should resolve deep category to tier_1', () => {
    const result = resolveCategoryToModel('deep');
    expect(result.tier).toBe('tier_1');
  });

  test('should resolve strategic category to tier_1', () => {
    const result = resolveCategoryToModel('strategic');
    expect(result.tier).toBe('tier_1');
  });

  test('should resolve visual category to multimodal', () => {
    const result = resolveCategoryToModel('visual');
    expect(result.tier).toBe('multimodal');
  });

  test('should resolve research category to tier_3', () => {
    const result = resolveCategoryToModel('research');
    expect(result.tier).toBe('tier_3');
  });

  test('should resolve creative category to tier_2', () => {
    const result = resolveCategoryToModel('creative');
    expect(result.tier).toBe('tier_2');
  });

  test('should fallback to tier_2 for unknown category', () => {
    const result = resolveCategoryToModel('unknown-category' as never);
    expect(result.tier).toBe('tier_2');
  });
});

describe('Delegation', () => {
  test('should delegate quick task to builder', () => {
    const result = delegateByCategory('quick');
    expect(result.agent).toBe('builder');
    expect(result.model).toBeTruthy();
    expect(result.config).toBeTruthy();
  });

  test('should delegate standard task to builder', () => {
    const result = delegateByCategory('standard');
    expect(result.agent).toBe('builder');
  });

  test('should delegate deep task to architect', () => {
    const result = delegateByCategory('deep');
    expect(result.agent).toBe('architect');
  });

  test('should delegate strategic task to architect', () => {
    const result = delegateByCategory('strategic');
    expect(result.agent).toBe('architect');
  });

  test('should delegate visual task to observer', () => {
    const result = delegateByCategory('visual');
    expect(result.agent).toBe('observer');
  });

  test('should delegate research task to researcher', () => {
    const result = delegateByCategory('research');
    expect(result.agent).toBe('researcher');
  });

  test('should use preferred agent if specified', () => {
    const result = delegateByCategory('standard', 'architect');
    expect(result.agent).toBe('architect');
  });

  test('should fallback to default if preferred agent cannot handle category', () => {
    const result = delegateByCategory('research', 'builder');
    expect(['builder', 'researcher']).toContain(result.agent);
  });
});

describe('Delegation Tool', () => {
  test('should create delegation tool', () => {
    const tool = createDelegationTool();
    expect(tool.name).toBe('delegate');
    expect(tool.execute).toBeFunction();
  });

  test('should delegate via tool', () => {
    const tool = createDelegationTool();
    const result = tool.execute('standard', 'Test task');
    expect(result.agent).toBe('builder');
    expect(result.model).toBeTruthy();
  });
});

describe('Summon Tool', () => {
  test('should create summon tool', () => {
    const tool = createSummonTool();
    expect(tool.name).toBe('summon');
    expect(tool.execute).toBeFunction();
  });

  test('should summon specific agent', () => {
    const tool = createSummonTool();
    const result = tool.execute('lead', 'Test task');
    expect(result.agent).toBe('lead');
    expect(result.config.role).toBe('lead');
  });
});

describe('Checkpoint Tool', () => {
  test('should create checkpoint tool', () => {
    const tool = createCheckpointTool();
    expect(tool.name).toBe('checkpoint');
    expect(tool.execute).toBeFunction();
  });

  test('should save checkpoint', () => {
    const tool = createCheckpointTool();
    const result = tool.execute('save');
    expect(result.saved).toBe(true);
    expect(result.checkpointId).toBeTruthy();
  });

  test('should load checkpoint', () => {
    const tool = createCheckpointTool();
    const result = tool.execute('load', 'cp-123');
    expect(result.loaded).toBe(true);
    expect(result.checkpointId).toBe('cp-123');
  });

  test('should list checkpoints', () => {
    const tool = createCheckpointTool();
    const result = tool.execute('list');
    expect(result.checkpoints).toBeArray();
  });

  test('should return error for invalid action', () => {
    const tool = createCheckpointTool();
    const result = tool.execute('invalid' as never);
    expect(result.error).toBe('Invalid action');
  });
});
