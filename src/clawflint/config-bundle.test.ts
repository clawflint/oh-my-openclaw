import { describe, test, expect } from 'bun:test';
import { createHmac } from 'crypto';
import { ConfigBundleManager } from './config-bundle.js';

function b64(value: unknown): string {
  return Buffer.from(
    typeof value === 'string' ? value : JSON.stringify(value),
    'utf8'
  ).toString('base64');
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('ConfigBundleManager', () => {
  test('should fetch and parse signed config bundle', async () => {
    const oldWorkerId = process.env.CLAWFLINT_WORKER_ID;
    const oldSecret = process.env.CONFIG_BUNDLE_SIGNING_SECRET;
    process.env.CLAWFLINT_WORKER_ID = 'worker-123';
    process.env.CONFIG_BUNDLE_SIGNING_SECRET = 'test-secret';

    const dataWithoutSignature = {
      configVersionId: 'v-1',
      versionNumber: '1',
      openclawConfig: b64({ plugin: 'omoc' }),
      systemPrompt: b64('You are OmOC'),
      envVars: b64({ NODE_ENV: 'test' }),
      onboardConfig: b64({
        omoc: {
          enabled: true,
          teamConfig: {
            agents: [{ role: 'builder', enabled: true, modelTier: 'tier_2' }],
            defaultWorkflow: 'run',
            maxParallelWorkers: 3,
          },
          costControls: {
            sessionBudgetUsd: 10,
            taskBudgetUsd: 3,
            alertThresholdPercent: 75,
          },
          eventRouting: { channels: { alerts: 'discord:1' } },
        },
      }),
    };

    const signature = createHmac('sha256', 'test-secret')
      .update(JSON.stringify(dataWithoutSignature))
      .digest('hex');

    const payload = {
      ok: true,
      data: {
        ...dataWithoutSignature,
        signature,
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () =>
      ({
        ok: true,
        status: 200,
        json: async () => payload,
      }) as Response) as unknown) as typeof fetch;

    const manager = new ConfigBundleManager();
    const bundle = await manager.fetchBundle('https://api.example.com', {
      keyId: 'kid',
      secret: 'ksecret',
    });

    expect(bundle).not.toBeNull();
    expect(manager.isOmocEnabled()).toBe(true);
    const extracted = manager.extractOmocConfig();
    expect(extracted).not.toBeNull();
    expect(extracted?.workflows?.parallelMaxWorkers).toBe(3);

    globalThis.fetch = originalFetch;
    restoreEnv('CLAWFLINT_WORKER_ID', oldWorkerId);
    restoreEnv('CONFIG_BUNDLE_SIGNING_SECRET', oldSecret);
  });
});
