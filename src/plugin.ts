import type { OmocConfig, StateManager } from './types/index.js';
import type { OmocMode } from './core/config-manager.js';
import type { DashboardEventType, DashboardEvent } from './dashboard/types.js';
import { FileStateManager } from './state/index.js';
import { createDefaultConfig } from './config/index.js';
import { configManager } from './core/config-manager.js';
import { SessionMonitor } from './dashboard/monitor.js';
import { EventEmitter, type EventPayload } from './events/emitter.js';
import { EventRouter, createEventSink } from './events/router.js';
import { HookRegistry, hookRegistry } from './hooks/index.js';
import { AGENT_REGISTRY } from './agents/index.js';

export interface PluginOptions {
  config?: OmocConfig;
  stateManager?: StateManager;
  mode?: OmocMode;
  events?: EventEmitter;
  eventSink?: (event: DashboardEvent | DashboardEvent[]) => void | Promise<void>;
}

export class OmocPlugin {
  private config: OmocConfig;
  private stateManager: StateManager;
  private hookRegistry: HookRegistry;
  private mode: OmocMode;
  private sessionMonitor: SessionMonitor;
  private events: EventEmitter;
  private eventRouter: EventRouter;

  constructor(options: PluginOptions) {
    this.config = options.config || createDefaultConfig('My Project', 'local');
    this.stateManager = options.stateManager || new FileStateManager();
    this.hookRegistry = hookRegistry;
    this.mode = options.mode || 'standalone';
    this.sessionMonitor = new SessionMonitor(this.stateManager);
    const { router, sink } = createEventSink(this.config.eventRouting);
    this.eventRouter = router;
    this.events = options.events || new EventEmitter({
      suppression: this.config.eventRouting.suppression as never,
      summaryMode: this.config.eventRouting.summaryMode
        ? {
            enabled: this.config.eventRouting.summaryMode.enabled,
            batchIntervalSeconds: this.config.eventRouting.summaryMode.batchIntervalSeconds,
            batchEvents: this.config.eventRouting.summaryMode.batchEvents as DashboardEventType[]
          }
        : undefined,
      sink: options.eventSink || sink
    });
  }

  static async create(options: PluginOptions = {}): Promise<OmocPlugin> {
    if (options.config) {
      return new OmocPlugin(options);
    }

    await configManager.initialize();
    return new OmocPlugin({
      ...options,
      config: configManager.getConfig(),
      mode: configManager.getMode()
    });
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

  getMode(): OmocMode {
    return this.mode;
  }

  getSessionMonitor(): SessionMonitor {
    return this.sessionMonitor;
  }

  getEventEmitter(): EventEmitter {
    return this.events;
  }

  getEventRouter(): EventRouter {
    return this.eventRouter;
  }

  emitEvent(
    sessionId: string,
    type: DashboardEventType,
    payload: EventPayload,
    channel?: string
  ) {
    return this.events.emit(sessionId, type, payload, channel);
  }

  static getAgentRegistry() {
    return AGENT_REGISTRY;
  }
}

export default OmocPlugin;
