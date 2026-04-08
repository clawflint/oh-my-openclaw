import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLog } from './audit-log.js';
import { rmSync, existsSync } from 'fs';

const TEST_PATH = '/tmp/omoc-audit-test/session.jsonl';

describe('AuditLog', () => {
  beforeEach(() => { if (existsSync('/tmp/omoc-audit-test')) rmSync('/tmp/omoc-audit-test', { recursive: true }); });
  afterEach(() => { if (existsSync('/tmp/omoc-audit-test')) rmSync('/tmp/omoc-audit-test', { recursive: true }); });

  it('logs and reads entries', () => {
    const log = new AuditLog(TEST_PATH);
    log.log('pipeline:started', { task: 'test' });
    const entries = log.read();
    expect(entries).toHaveLength(1);
    expect(entries[0].event).toBe('pipeline:started');
    expect(entries[0].details.task).toBe('test');
  });
  it('logs with agent and session', () => {
    const log = new AuditLog(TEST_PATH);
    log.log('agent:spawned', { model: 'opus' }, 'builder', 'session-1');
    const entries = log.read();
    expect(entries[0].agent).toBe('builder');
    expect(entries[0].sessionId).toBe('session-1');
  });
  it('reads by event type', () => {
    const log = new AuditLog(TEST_PATH);
    log.log('stage:started', {});
    log.log('stage:completed', {});
    log.log('stage:started', {});
    expect(log.readByEvent('stage:started')).toHaveLength(2);
  });
  it('reads by agent', () => {
    const log = new AuditLog(TEST_PATH);
    log.log('work', {}, 'builder');
    log.log('work', {}, 'reviewer');
    log.log('work', {}, 'builder');
    expect(log.readByAgent('builder')).toHaveLength(2);
  });
  it('reads with limit', () => {
    const log = new AuditLog(TEST_PATH);
    for (let i = 0; i < 10; i++) log.log('event', { i });
    expect(log.read(3)).toHaveLength(3);
  });
  it('returns empty for nonexistent file', () => {
    const log = new AuditLog('/tmp/omoc-audit-test/nonexistent.jsonl');
    expect(log.read()).toEqual([]);
  });
});
