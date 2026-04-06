import type { DashboardEvent, DashboardEventType } from "../dashboard/types.js";
import { randomUUID } from "crypto";

export interface EventPayload {
  [key: string]: unknown;
}

export interface EventSuppressionRule {
  cooldownSeconds?: number;
  interval?: number;
}

export interface SummaryModeOptions {
  enabled: boolean;
  batchIntervalSeconds: number;
  batchEvents: DashboardEventType[];
}

export interface EventEmitterOptions {
  maxHistory?: number;
  suppression?: Partial<Record<DashboardEventType, EventSuppressionRule>>;
  summaryMode?: SummaryModeOptions;
  sink?: (event: DashboardEvent | DashboardEvent[]) => void | Promise<void>;
  secretPatterns?: RegExp[];
}

export class EventEmitter {
  private listeners: Map<
    DashboardEventType,
    Array<(event: DashboardEvent) => void>
  > = new Map();
  private history: DashboardEvent[] = [];
  private maxHistory: number;
  private suppression: Partial<Record<DashboardEventType, EventSuppressionRule>>;
  private summaryMode?: SummaryModeOptions;
  private sink?: (event: DashboardEvent | DashboardEvent[]) => void | Promise<void>;
  private lastEmitByType: Map<DashboardEventType, number> = new Map();
  private emitCountByType: Map<DashboardEventType, number> = new Map();
  private summaryBuffer: DashboardEvent[] = [];
  private summaryTimer: ReturnType<typeof setInterval> | null = null;
  private secretPatterns: RegExp[];

  constructor(options: EventEmitterOptions = {}) {
    this.maxHistory = options.maxHistory ?? 1000;
    this.suppression = options.suppression ?? {};
    this.summaryMode = options.summaryMode;
    this.sink = options.sink;
    this.secretPatterns = options.secretPatterns ?? [
      /sk-[a-zA-Z0-9_-]{16,}/g,
      /sk-ant-[a-zA-Z0-9_-]{16,}/g,
      /AIza[0-9A-Za-z\-_]{20,}/g,
      /ghp_[a-zA-Z0-9]{20,}/g,
      /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g
    ];

    if (this.summaryMode?.enabled) {
      this.summaryTimer = setInterval(
        () => void this.flushSummary(),
        this.summaryMode.batchIntervalSeconds * 1000
      );
    }
  }

  emit(
    sessionId: string,
    type: DashboardEventType,
    payload: EventPayload,
    channel: string = "default",
  ): DashboardEvent | null {
    if (!this.shouldEmit(type)) {
      return null;
    }

    const event: DashboardEvent = {
      id: randomUUID(),
      sessionId,
      type,
      timestamp: new Date().toISOString(),
      payload: this.redactPayload(payload),
      channel,
    };

    this.history.push(event);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.lastEmitByType.set(type, Date.now());

    if (this.summaryMode?.enabled && this.summaryMode.batchEvents.includes(type)) {
      this.summaryBuffer.push(event);
      return event;
    }

    const handlers = this.listeners.get(type) || [];
    handlers.forEach((handler) => {
      try {
        handler(event);
      } catch {}
    });

    if (this.sink) {
      void Promise.resolve(this.sink(event)).catch(() => {});
    }

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

  setSink(
    sink: (event: DashboardEvent | DashboardEvent[]) => void | Promise<void>,
  ): void {
    this.sink = sink;
  }

  async flushSummary(): Promise<void> {
    if (!this.summaryBuffer.length) {
      return;
    }

    const batched = [...this.summaryBuffer];
    this.summaryBuffer = [];

    if (this.sink) {
      try {
        await this.sink(batched);
      } catch {}
    }
  }

  shutdown(): void {
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
      this.summaryTimer = null;
    }
    void this.flushSummary();
  }

  private shouldEmit(type: DashboardEventType): boolean {
    const now = Date.now();
    const rule = this.suppression[type];
    if (!rule) {
      return true;
    }

    const nextCount = (this.emitCountByType.get(type) || 0) + 1;
    this.emitCountByType.set(type, nextCount);

    if (rule.interval && nextCount % rule.interval !== 0) {
      return false;
    }

    const last = this.lastEmitByType.get(type);
    if (rule.cooldownSeconds && last && now - last < rule.cooldownSeconds * 1000) {
      return false;
    }

    return true;
  }

  private redactPayload(payload: EventPayload): EventPayload {
    const scrubbed = this.redactValue(payload);
    return scrubbed as EventPayload;
  }

  private redactValue(value: unknown): unknown {
    if (typeof value === "string") {
      let output = value;
      for (const pattern of this.secretPatterns) {
        output = output.replace(pattern, "[REDACTED]");
      }
      return output;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item));
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.redactValue(nested);
      }
      return result;
    }

    return value;
  }
}

export const eventEmitter = new EventEmitter();
