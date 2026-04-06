import { describe, test, expect } from 'bun:test';
import { EventEmitter } from './emitter.js';

describe('EventEmitter', () => {
  test('should redact secret-like payload values', () => {
    const emitter = new EventEmitter();
    const event = emitter.emit('s1', 'session.start', {
      token: 'sk-abc1234567890123456789',
    });

    expect(event).not.toBeNull();
    if (event) {
      expect(event.payload.token).toBe('[REDACTED]');
    }
  });

  test('should apply interval suppression', () => {
    const emitter = new EventEmitter({
      suppression: {
        'git.commit': { interval: 2 },
      },
    });

    const first = emitter.emit('s1', 'git.commit', { n: 1 });
    const second = emitter.emit('s1', 'git.commit', { n: 2 });

    expect(first).toBeNull();
    expect(second).not.toBeNull();
  });

  test('should batch summary events and flush to sink', async () => {
    const sinkCalls: unknown[] = [];
    const emitter = new EventEmitter({
      summaryMode: {
        enabled: true,
        batchIntervalSeconds: 60,
        batchEvents: ['git.commit'],
      },
      sink: (payload) => {
        sinkCalls.push(payload);
      },
    });

    emitter.emit('s1', 'git.commit', { msg: 'a' });
    await emitter.flushSummary();
    emitter.shutdown();

    expect(sinkCalls.length).toBe(1);
    const [batched] = sinkCalls as Array<Array<unknown>>;
    expect(Array.isArray(batched)).toBe(true);
    expect(batched.length).toBe(1);
  });
});
