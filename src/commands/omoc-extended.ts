import type { CommandHandler } from './handlers.js';
import type { CommandContext, CommandResult, StateManager } from '../types/index.js';

export class OmocHealthCommand implements CommandHandler {
  name = '/omoc health';
  description = 'Lightweight health check';

  async execute(_context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const checks = {
      plugin: true,
      runtime: true,
      state: true
    };

    try {
      Bun.version;
    } catch {
      checks.runtime = false;
    }

    try {
      stateManager.listSessions();
    } catch {
      checks.state = false;
    }

    const allHealthy = Object.values(checks).every(v => v);
    const status = allHealthy ? 'OK' : checks.state ? 'WARN' : 'ERROR';

    return {
      success: allHealthy,
      message: `Health: ${status}\nPlugin: OK\nRuntime: ${checks.runtime ? 'OK' : 'FAIL'}\nState: ${checks.state ? 'OK' : 'FAIL'}`,
      data: { status, checks }
    };
  }
}

export class OmocConfigCommand implements CommandHandler {
  name = '/omoc config';
  description = 'Show current configuration';

  async execute(_context: CommandContext, _stateManager: StateManager): Promise<CommandResult> {
    const { configManager } = await import('../core/config-manager.js');
    await configManager.initialize();
    const config = configManager.getConfig();

    const maskedConfig = {
      ...config,
      project: {
        ...config.project,
        repo: config.project.repo.replace(/[^/]+$/, '***')
      }
    };

    return {
      success: true,
      message: `Configuration (${configManager.getMode()} mode):\n${JSON.stringify(maskedConfig, null, 2)}`,
      data: { config: maskedConfig, mode: configManager.getMode() }
    };
  }
}
