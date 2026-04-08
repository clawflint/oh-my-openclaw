import { describe, it, expect, vi } from 'vitest';
import { PipelineEventEmitter, createPipelineEvent, formatEventForChannel } from './pipeline-events.js';

describe('PipelineEventEmitter', () => {
  it('emits to registered sinks', () => {
    const emitter = new PipelineEventEmitter();
    const sink = vi.fn();
    emitter.addSink(sink);
    emitter.emitPipelineStarted('p1', 'test task');
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0].type).toBe('pipeline:started');
    expect(sink.mock.calls[0][0].data.task).toBe('test task');
  });

  it('emits stage events', () => {
    const emitter = new PipelineEventEmitter();
    const events: any[] = [];
    emitter.addSink(e => events.push(e));
    emitter.emitStageStarted('p1', 'classify', 'lead', 'opus');
    emitter.emitStageCompleted('p1', 'classify', 'lead', 500, { input: 100, output: 50 });
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('pipeline:stage:started');
    expect(events[1].type).toBe('pipeline:stage:completed');
  });

  it('handles sink errors gracefully', () => {
    const emitter = new PipelineEventEmitter();
    emitter.addSink(() => { throw new Error('boom'); });
    const good = vi.fn();
    emitter.addSink(good);
    emitter.emitPipelineStarted('p1', 'task');
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('emits budget alert', () => {
    const emitter = new PipelineEventEmitter();
    const sink = vi.fn();
    emitter.addSink(sink);
    emitter.emitBudgetAlert('p1', 7.5, 10, 75);
    expect(sink.mock.calls[0][0].type).toBe('pipeline:budget:alert');
  });
});

describe('createPipelineEvent', () => {
  it('creates event with timestamp', () => {
    const event = createPipelineEvent('pipeline:started', 'p1', { task: 'hello' });
    expect(event.type).toBe('pipeline:started');
    expect(event.pipelineId).toBe('p1');
    expect(event.timestamp).toBeDefined();
    expect(event.data.task).toBe('hello');
  });
});

describe('formatEventForChannel', () => {
  it('formats pipeline:started', () => {
    const e = createPipelineEvent('pipeline:started', 'p1', { task: 'build feature' });
    expect(formatEventForChannel(e)).toContain('🚀');
    expect(formatEventForChannel(e)).toContain('build feature');
  });
  it('formats pipeline:stage:completed', () => {
    const e = createPipelineEvent('pipeline:stage:completed', 'p1', { stage: 'build', agent: 'builder', durationMs: 1500 });
    expect(formatEventForChannel(e)).toContain('✅');
    expect(formatEventForChannel(e)).toContain('builder');
  });
  it('formats pipeline:failed', () => {
    const e = createPipelineEvent('pipeline:failed', 'p1', { reason: 'budget exceeded' });
    expect(formatEventForChannel(e)).toContain('💥');
    expect(formatEventForChannel(e)).toContain('budget exceeded');
  });
  it('formats budget alert', () => {
    const e = createPipelineEvent('pipeline:budget:alert', 'p1', { currentCost: 7.5, budget: 10, percent: 75 });
    expect(formatEventForChannel(e)).toContain('⚠️');
    expect(formatEventForChannel(e)).toContain('75%');
  });
});
