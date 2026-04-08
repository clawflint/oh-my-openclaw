import { describe, it, expect } from 'vitest';
import { enforceRunPipeline, enforcePlanPipeline, pipelineEnforcerHandler, type PipelineMessageContext } from './pipeline-enforcer.js';

describe('enforceRunPipeline', () => {
  it('generates 4-stage pipeline instructions', () => {
    const result = enforceRunPipeline('add hello endpoint');
    expect(result).toContain('STAGE 1');
    expect(result).toContain('STAGE 2');
    expect(result).toContain('STAGE 3');
    expect(result).toContain('STAGE 4');
  });

  it('includes correct models', () => {
    const result = enforceRunPipeline('fix bug');
    expect(result).toContain('claude-opus-4-6'); // lead = tier_1
    expect(result).toContain('claude-sonnet-4-6'); // builder = tier_2
  });

  it('includes sessions_spawn instructions', () => {
    const result = enforceRunPipeline('task');
    expect(result).toContain('sessions_spawn');
    expect(result).toContain('omoc-lead');
    expect(result).toContain('omoc-builder');
    expect(result).toContain('omoc-reviewer');
  });

  it('includes the original task in each stage', () => {
    const result = enforceRunPipeline('refactor auth module');
    expect(result).toContain('refactor auth module');
  });

  it('includes persona fragments', () => {
    const result = enforceRunPipeline('task');
    expect(result).toContain('Lead');  // from lead's systemPrompt
    expect(result).toContain('Builder'); // from builder's systemPrompt
  });
});

describe('enforcePlanPipeline', () => {
  it('generates 3-stage plan-only pipeline', () => {
    const result = enforcePlanPipeline('add feature');
    expect(result).toContain('STAGE 1');
    expect(result).toContain('STAGE 2');
    expect(result).toContain('STAGE 3');
    expect(result).toContain('DO NOT implement');
  });

  it('includes auditor stage', () => {
    const result = enforcePlanPipeline('task');
    expect(result).toContain('omoc-auditor');
  });
});

describe('pipelineEnforcerHandler', () => {
  it('rewrites /run messages with pipeline instructions', () => {
    const ctx: PipelineMessageContext = { body: '/run add hello endpoint' };
    pipelineEnforcerHandler(ctx);
    expect(ctx.bodyForAgent).toContain('STAGE 1');
    expect(ctx.bodyForAgent).toContain('sessions_spawn');
  });

  it('rewrites /plan messages with plan-only pipeline', () => {
    const ctx: PipelineMessageContext = { body: '/plan design auth system' };
    pipelineEnforcerHandler(ctx);
    expect(ctx.bodyForAgent).toContain('DO NOT implement');
  });

  it('does not rewrite normal messages', () => {
    const ctx: PipelineMessageContext = { body: 'hello world' };
    pipelineEnforcerHandler(ctx);
    expect(ctx.bodyForAgent).toBeUndefined();
  });

  it('does not rewrite bare /run with no task', () => {
    const ctx: PipelineMessageContext = { body: '/run' };
    pipelineEnforcerHandler(ctx);
    expect(ctx.bodyForAgent).toBeUndefined();
  });
});
