import { describe, test, expect } from 'bun:test';
import { ConfigManager, StandaloneConfigProvider, ClawFlintConfigProvider } from './config-manager.js';

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('ConfigManager', () => {
  test('should detect standalone mode by default', () => {
    const oldWorker = process.env.CLAWFLINT_WORKER_ID;
    const oldKey = process.env.CLAWFLINT_KEY_ID;
    delete process.env.CLAWFLINT_WORKER_ID;
    delete process.env.CLAWFLINT_KEY_ID;

    const manager = new ConfigManager();
    expect(manager.getMode()).toBe('standalone');

    restoreEnv('CLAWFLINT_WORKER_ID', oldWorker);
    restoreEnv('CLAWFLINT_KEY_ID', oldKey);
  });

  test('should detect clawflint mode when worker/key env exists', () => {
    const oldWorker = process.env.CLAWFLINT_WORKER_ID;
    process.env.CLAWFLINT_WORKER_ID = 'worker-1';

    const manager = new ConfigManager();
    expect(manager.getMode()).toBe('clawflint');

    restoreEnv('CLAWFLINT_WORKER_ID', oldWorker);
  });

  test('standalone provider should return defaults when no file exists', async () => {
    const provider = new StandaloneConfigProvider('.omoc-non-existent');
    const config = await provider.getConfig();
    expect(config).not.toBeNull();
    if (config) {
      expect(config.project.name).toBeTruthy();
      expect(config.workflows.loopMaxIterations).toBe(100);
    }
  });

  test('clawflint provider should return null without credentials', async () => {
    const oldKey = process.env.CLAWFLINT_KEY_ID;
    const oldSecret = process.env.CLAWFLINT_KEY_SECRET;
    delete process.env.CLAWFLINT_KEY_ID;
    delete process.env.CLAWFLINT_KEY_SECRET;

    const provider = new ClawFlintConfigProvider('https://api.example.com');
    const config = await provider.getConfig();
    expect(config).toBeNull();

    restoreEnv('CLAWFLINT_KEY_ID', oldKey);
    restoreEnv('CLAWFLINT_KEY_SECRET', oldSecret);
  });
});
