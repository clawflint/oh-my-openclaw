import type { DashboardEvent, DashboardEventType } from '../dashboard/types.js';
import type { EventRoutingConfig } from '../types/index.js';

export interface RoutedEvent {
  event: DashboardEvent;
  route: string;
  mention?: string;
}

export class EventRouter {
  private config: EventRoutingConfig;
  private deliveries: RoutedEvent[] = [];

  constructor(config: EventRoutingConfig) {
    this.config = config;
  }

  route(event: DashboardEvent): RoutedEvent {
    const route = this.resolveRoute(event.type);
    const mention = this.resolveMention(event.type);
    const routed: RoutedEvent = { event, route, mention };
    this.deliveries.push(routed);
    return routed;
  }

  routeBatch(events: DashboardEvent[]): RoutedEvent[] {
    return events.map((event) => this.route(event));
  }

  getDeliveries(limit: number = 100): RoutedEvent[] {
    return this.deliveries.slice(-limit);
  }

  clear(): void {
    this.deliveries = [];
  }

  private resolveRoute(type: DashboardEventType): string {
    if (type.startsWith('git.')) {
      return this.config.channels['build-log'] || 'build-log';
    }
    if (type.startsWith('verification.')) {
      return this.config.channels['agent-status'] || 'agent-status';
    }
    if (type.startsWith('cost.') || type.endsWith('.error') || type.endsWith('.fail')) {
      return this.config.channels.alerts || 'alerts';
    }
    return this.config.channels['agent-status'] || 'agent-status';
  }

  private resolveMention(type: DashboardEventType): string | undefined {
    if (this.config.mentionPolicy[type]) {
      return this.config.mentionPolicy[type];
    }
    if (type.includes('error') || type.includes('fail')) {
      return this.config.mentionPolicy.alerts;
    }
    return undefined;
  }
}

export function createEventSink(config: EventRoutingConfig): {
  router: EventRouter;
  sink: (event: DashboardEvent | DashboardEvent[]) => Promise<void>;
} {
  const router = new EventRouter(config);
  return {
    router,
    sink: async (event) => {
      if (Array.isArray(event)) {
        router.routeBatch(event);
      } else {
        router.route(event);
      }
    }
  };
}
