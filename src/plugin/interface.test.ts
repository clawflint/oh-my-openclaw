import { describe, test, expect } from 'bun:test';
import { createOpenClawPluginRuntime } from './interface.js';

describe('OpenClaw Plugin Interface', () => {
  test('should expose manifest, hooks, commands, and tools', async () => {
    const runtime = await createOpenClawPluginRuntime();

    expect(runtime.manifest.name).toBe('oh-my-openclaw');
    expect(runtime.hooks['gateway:startup']).toBeFunction();
    expect(runtime.hooks['message:received']).toBeFunction();
    expect(runtime.commands['/omoc']).toBeDefined();
    expect(runtime.commands['/run']).toBeDefined();
    expect(runtime.tools.length).toBe(3);
  });
});
