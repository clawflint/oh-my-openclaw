import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export interface AuditEntry {
  timestamp: string;
  event: string;
  agent?: string;
  sessionId?: string;
  details: Record<string, unknown>;
}

export class AuditLog {
  private path: string;

  constructor(path: string = '.omoc/session.jsonl') {
    this.path = path;
    mkdirSync(dirname(this.path), { recursive: true });
  }

  log(event: string, details: Record<string, unknown> = {}, agent?: string, sessionId?: string): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...(agent ? { agent } : {}),
      ...(sessionId ? { sessionId } : {}),
      details,
    };
    appendFileSync(this.path, JSON.stringify(entry) + '\n');
  }

  read(limit?: number): AuditEntry[] {
    if (!existsSync(this.path)) return [];
    const lines = readFileSync(this.path, 'utf-8').split('\n').filter(Boolean);
    const entries = lines.map(l => JSON.parse(l) as AuditEntry);
    return limit ? entries.slice(-limit) : entries;
  }

  readByEvent(event: string): AuditEntry[] {
    return this.read().filter(e => e.event === event);
  }

  readByAgent(agent: string): AuditEntry[] {
    return this.read().filter(e => e.agent === agent);
  }

  readBySession(sessionId: string): AuditEntry[] {
    return this.read().filter(e => e.sessionId === sessionId);
  }
}
