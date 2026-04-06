import type { DashboardEvent, DashboardEventType } from "../dashboard/types.js";
import { randomUUID } from "crypto";

export interface EventPayload {
  [key: string]: unknown;
}

export class EventEmitter {
  private listeners: Map<
    DashboardEventType,
    Array<(event: DashboardEvent) => void>
  > = new Map();
  private history: DashboardEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 1000) {
    this.maxHistory = maxHistory;
  }

  emit(
    sessionId: string,
    type: DashboardEventType,
    payload: EventPayload,
    channel: string = "default",
  ): DashboardEvent {
    const event: DashboardEvent = {
      id: randomUUID(),
      sessionId,
      type,
      timestamp: new Date().toISOString(),
      payload,
      channel,
    };

    this.history.push(event);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const handlers = this.listeners.get(type) || [];
    handlers.forEach((handler) => {
      try {
        handler(event);
      } catch {}
    });

    return event;
  }

  on(
    type: DashboardEventType,
    handler: (event: DashboardEvent) => void,
  ): () => void {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    };
  }

  getHistory(sessionId?: string, limit: number = 100): DashboardEvent[] {
    let events = this.history;

    if (sessionId) {
      events = events.filter((e) => e.sessionId === sessionId);
    }

    return events.slice(-limit);
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const eventEmitter = new EventEmitter();
