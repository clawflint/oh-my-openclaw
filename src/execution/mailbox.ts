import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

export interface MailboxMessage {
  id: string;
  from: string;
  to: string;
  type: 'assignment' | 'completion' | 'error' | 'nudge' | 'cancel';
  payload: Record<string, unknown>;
  timestamp: string;
}

export class Mailbox {
  private basePath: string;

  constructor(sessionId: string, basePath: string = '.omoc/state/sessions') {
    this.basePath = join(basePath, sessionId, 'mailbox');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  private getInboxPath(workerId: string): string {
    return join(this.basePath, `${workerId}-inbox.jsonl`);
  }

  async send(to: string, message: Omit<MailboxMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: MailboxMessage = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString()
    };

    const inboxPath = this.getInboxPath(to);
    this.ensureDirectory();

    const line = JSON.stringify(fullMessage) + '\n';
    appendFileSync(inboxPath, line);
  }

  async receive(workerId: string, since?: string): Promise<MailboxMessage[]> {
    const inboxPath = this.getInboxPath(workerId);
    
    if (!existsSync(inboxPath)) {
      return [];
    }

    try {
      const content = readFileSync(inboxPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const messages = lines
        .map(line => {
          try {
            return JSON.parse(line) as MailboxMessage;
          } catch {
            return null;
          }
        })
        .filter((msg): msg is MailboxMessage => msg !== null);

      if (since) {
        return messages.filter(msg => msg.timestamp > since);
      }

      return messages;
    } catch {
      return [];
    }
  }

  async acknowledge(workerId: string, messageId: string): Promise<void> {
    const messages = await this.receive(workerId);
    const filtered = messages.filter(m => m.id !== messageId);
    
    const inboxPath = this.getInboxPath(workerId);
    const content = filtered.map(m => JSON.stringify(m)).join('\n') + '\n';
    writeFileSync(inboxPath, content);
  }

  async sendNudge(workerId: string, taskId: string): Promise<void> {
    await this.send(workerId, {
      from: 'foreman',
      to: workerId,
      type: 'nudge',
      payload: { taskId, message: 'Still working on this task?' }
    });
  }

  async sendCancellation(workerId: string, reason?: string): Promise<void> {
    await this.send(workerId, {
      from: 'foreman',
      to: workerId,
      type: 'cancel',
      payload: { reason: reason || 'Session cancelled by user' }
    });
  }

  async reportCompletion(workerId: string, taskId: string, result: unknown): Promise<void> {
    await this.send('foreman', {
      from: workerId,
      to: 'foreman',
      type: 'completion',
      payload: { taskId, result }
    });
  }

  async reportError(workerId: string, taskId: string, error: string): Promise<void> {
    await this.send('foreman', {
      from: workerId,
      to: 'foreman',
      type: 'error',
      payload: { taskId, error }
    });
  }
}
