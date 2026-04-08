export type PipelineEventType =
  | 'pipeline:started'
  | 'pipeline:stage:started'
  | 'pipeline:stage:completed'
  | 'pipeline:stage:failed'
  | 'pipeline:completed'
  | 'pipeline:failed'
  | 'pipeline:budget:alert'
  | 'pipeline:budget:exceeded';

export interface PipelineEvent {
  type: PipelineEventType;
  pipelineId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function createPipelineEvent(
  type: PipelineEventType,
  pipelineId: string,
  data: Record<string, unknown> = {}
): PipelineEvent {
  return {
    type,
    pipelineId,
    timestamp: new Date().toISOString(),
    data,
  };
}

export type EventSink = (event: PipelineEvent) => void;

export class PipelineEventEmitter {
  private sinks: EventSink[] = [];

  addSink(sink: EventSink): void {
    this.sinks.push(sink);
  }

  emit(event: PipelineEvent): void {
    for (const sink of this.sinks) {
      try { sink(event); } catch { /* don't let sink errors break pipeline */ }
    }
  }

  emitStageStarted(pipelineId: string, stage: string, agent: string, model: string): void {
    this.emit(createPipelineEvent('pipeline:stage:started', pipelineId, { stage, agent, model }));
  }

  emitStageCompleted(pipelineId: string, stage: string, agent: string, durationMs: number, tokens: { input: number; output: number }): void {
    this.emit(createPipelineEvent('pipeline:stage:completed', pipelineId, { stage, agent, durationMs, tokens }));
  }

  emitStageFailed(pipelineId: string, stage: string, agent: string, error: string): void {
    this.emit(createPipelineEvent('pipeline:stage:failed', pipelineId, { stage, agent, error }));
  }

  emitPipelineStarted(pipelineId: string, task: string): void {
    this.emit(createPipelineEvent('pipeline:started', pipelineId, { task }));
  }

  emitPipelineCompleted(pipelineId: string, stages: number, totalCost: number): void {
    this.emit(createPipelineEvent('pipeline:completed', pipelineId, { stages, totalCost }));
  }

  emitPipelineFailed(pipelineId: string, reason: string): void {
    this.emit(createPipelineEvent('pipeline:failed', pipelineId, { reason }));
  }

  emitBudgetAlert(pipelineId: string, currentCost: number, budget: number, percent: number): void {
    this.emit(createPipelineEvent('pipeline:budget:alert', pipelineId, { currentCost, budget, percent }));
  }
}

export function formatEventForChannel(event: PipelineEvent): string {
  switch (event.type) {
    case 'pipeline:started':
      return `🚀 Pipeline started: ${event.data.task}`;
    case 'pipeline:stage:started':
      return `⏳ Stage ${event.data.stage}: ${event.data.agent} (${event.data.model})`;
    case 'pipeline:stage:completed':
      return `✅ Stage ${event.data.stage}: ${event.data.agent} completed in ${event.data.durationMs}ms`;
    case 'pipeline:stage:failed':
      return `❌ Stage ${event.data.stage}: ${event.data.agent} failed — ${event.data.error}`;
    case 'pipeline:completed':
      return `🎉 Pipeline completed: ${event.data.stages} stages, $${(event.data.totalCost as number).toFixed(4)}`;
    case 'pipeline:failed':
      return `💥 Pipeline failed: ${event.data.reason}`;
    case 'pipeline:budget:alert':
      return `⚠️ Budget alert: $${(event.data.currentCost as number).toFixed(4)} / $${event.data.budget} (${(event.data.percent as number).toFixed(0)}%)`;
    default:
      return `[${event.type}] ${JSON.stringify(event.data)}`;
  }
}
