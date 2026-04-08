import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlanStore, type PlanRecord } from './plan-store.js';
import { rmSync, existsSync } from 'fs';

const TEST_DIR = '/tmp/omoc-test-plans';

function makePlan(id: string): PlanRecord {
  return {
    id,
    task: 'test task',
    status: 'completed',
    stages: [{ stage: 'classify', agent: 'lead', model: 'opus', status: 'done' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cost: 0.05,
  };
}

describe('PlanStore', () => {
  beforeEach(() => { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }); });
  afterEach(() => { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }); });

  it('creates directory on init', () => {
    new PlanStore(TEST_DIR);
    expect(existsSync(TEST_DIR)).toBe(true);
  });

  it('saves and loads a plan', () => {
    const store = new PlanStore(TEST_DIR);
    const plan = makePlan('plan-1');
    store.save(plan);
    const loaded = store.load('plan-1');
    expect(loaded).toEqual(plan);
  });

  it('returns null for missing plan', () => {
    const store = new PlanStore(TEST_DIR);
    expect(store.load('nonexistent')).toBeNull();
  });

  it('tracks latest plan', () => {
    const store = new PlanStore(TEST_DIR);
    store.save(makePlan('plan-1'));
    store.save(makePlan('plan-2'));
    const latest = store.loadLatest();
    expect(latest?.id).toBe('plan-2');
  });

  it('lists all plans', () => {
    const store = new PlanStore(TEST_DIR);
    store.save(makePlan('plan-a'));
    store.save(makePlan('plan-b'));
    const ids = store.list();
    expect(ids).toContain('plan-a');
    expect(ids).toContain('plan-b');
    expect(ids).not.toContain('latest');
  });

  it('deletes a plan', () => {
    const store = new PlanStore(TEST_DIR);
    store.save(makePlan('plan-del'));
    expect(store.delete('plan-del')).toBe(true);
    expect(store.load('plan-del')).toBeNull();
  });

  it('returns false when deleting nonexistent', () => {
    const store = new PlanStore(TEST_DIR);
    expect(store.delete('nope')).toBe(false);
  });
});
