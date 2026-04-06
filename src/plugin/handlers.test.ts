import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FileStateManager } from '../state/file-state-manager.js';
import { onAgentBootstrap, onMessageReceived } from './handlers.js';

const TEST_DIR = '.omoc-test-plugin-handlers';

describe('Plugin Handlers', () => {
  let stateManager: FileStateManager;

  beforeEach(() => {
    stateManager = new FileStateManager(TEST_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      const rmrf = (dir: string) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            rmrf(fullPath);
          } else {
            unlinkSync(fullPath);
          }
        }
        rmdirSync(dir);
      };
      rmrf(TEST_DIR);
    }
  });

  test('should execute slash commands from message context', async () => {
    const result = await onMessageReceived({
      stateManager,
      message: {
        content: '/loop fix failing tests',
        userId: 'user-1',
        channelId: 'chan-1',
      },
    });

    expect(result.handled).toBe(true);
    expect(result.result?.success).toBe(true);
  });

  test('should inject AGENTS overlay into agent prompt', async () => {
    const workspace = join(TEST_DIR, 'workspace');
    mkdirSync(workspace, { recursive: true });
    writeFileSync(
      join(workspace, 'AGENTS.md'),
      [
        '## Execution Protocol',
        '- Always run tests',
        '',
        '## Constraints',
        '- Never force push',
      ].join('\n')
    );

    const result = await onAgentBootstrap({
      systemPrompt: 'Base prompt',
      workingDirectory: workspace,
    });

    expect(result.systemPrompt).toContain('Project Execution Protocol');
    expect(result.systemPrompt).toContain('Never force push');
  });
});
