import type { OmocConfig, StateManager } from './types/index.js';
import { FileStateManager } from './state/index.js';
import { HookRegistry, hookRegistry } from './hooks/index.js';
import { AGENT_REGISTRY } from './agents/index.js';

export interface PluginOptions {
  config: OmocConfig;
  stateManager?: StateManager;
}

export class OmocPlugin {
  private config: OmocConfig;
  private stateManager: StateManager;
  private hookRegistry: HookRegistry;

  constructor(options: PluginOptions) {
    this.config = options.config;
    this.stateManager = options.stateManager || new FileStateManager();
    this.hookRegistry = hookRegistry;
  }

  getConfig(): OmocConfig {
    return this.config;
  }

  getStateManager(): StateManager {
    return this.stateManager;
  }

  getHookRegistry(): HookRegistry {
    return this.hookRegistry;
  }

  static getAgentRegistry() {
    return AGENT_REGISTRY;
  }
}

export default OmocPlugin;
