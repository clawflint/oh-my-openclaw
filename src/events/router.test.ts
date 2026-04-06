import { describe, test, expect } from 'bun:test';
import { EventRouter, createEventSink } from './router.js';
import type { EventRoutingConfig } from '../types/index.js';

const config: EventRoutingConfig = {
  channels: {
    'agent-status': 'discord:status',
    'build-log': 'discord:build',
    alerts: 'discord:alerts',
  },
  mentionPolicy: {
    alerts: '@ops',
    'plan.ready': '@owner',
  },
};

describe('EventRouter', () => {
  test('should map git events to build-log channel', () => {
    const router = new EventRouter(config);
    const routed = router.route({
      id: 'e1',
      sessionId: 's1',
      type: 'git.commit',
      timestamp: new Date().toISOString(),
      payload: {},
      channel: 'default',
    });

    expect(routed.route).toBe('discord:build');
  });

  test('should map failure events to alerts channel', () => {
    const router = new EventRouter(config);
    const routed = router.route({
      id: 'e2',
      sessionId: 's1',
      type: 'session.error',
      timestamp: new Date().toISOString(),
      payload: {},
      channel: 'default',
    });

    expect(routed.route).toBe('discord:alerts');
    expect(routed.mention).toBe('@ops');
  });

  test('createEventSink should route batches', async () => {
    const { router, sink } = createEventSink(config);
    await sink([
      {
        id: 'e3',
        sessionId: 's1',
        type: 'session.start',
        timestamp: new Date().toISOString(),
        payload: {},
        channel: 'default',
      },
      {
        id: 'e4',
        sessionId: 's1',
        type: 'git.merge',
        timestamp: new Date().toISOString(),
        payload: {},
        channel: 'default',
      },
    ]);

    expect(router.getDeliveries().length).toBe(2);
  });
});
