// src/support/runtime-overlay.ts
import type { AgentRole } from '../types/index.js';

export interface RuntimeOverlay {
  id: string;
  scope: 'session' | 'task';
  targetAgent?: AgentRole;
  constraints: string[];
  directives: string[];
  expiresAt?: string;
  createdAt: string;
}

export class RuntimeOverlayManager {
  private overlays: RuntimeOverlay[] = [];

  add(overlay: Omit<RuntimeOverlay, 'createdAt'>): void {
    this.overlays.push({ ...overlay, createdAt: new Date().toISOString() });
  }

  remove(id: string): boolean {
    const before = this.overlays.length;
    this.overlays = this.overlays.filter(o => o.id !== id);
    return this.overlays.length < before;
  }

  getForAgent(role: AgentRole, scope?: 'session' | 'task'): RuntimeOverlay[] {
    const now = new Date().toISOString();
    return this.overlays.filter(o => {
      if (o.expiresAt && o.expiresAt < now) return false;
      if (o.targetAgent && o.targetAgent !== role) return false;
      if (scope && o.scope !== scope) return false;
      return true;
    });
  }

  getActiveConstraints(role: AgentRole): string[] {
    return this.getForAgent(role).flatMap(o => o.constraints);
  }

  getActiveDirectives(role: AgentRole): string[] {
    return this.getForAgent(role).flatMap(o => o.directives);
  }

  compileOverlayPrompt(role: AgentRole): string {
    const constraints = this.getActiveConstraints(role);
    const directives = this.getActiveDirectives(role);
    if (constraints.length === 0 && directives.length === 0) return '';

    const parts: string[] = [];
    if (constraints.length > 0) {
      parts.push('## Runtime Constraints\n' + constraints.map(c => `- ${c}`).join('\n'));
    }
    if (directives.length > 0) {
      parts.push('## Runtime Directives\n' + directives.map(d => `- ${d}`).join('\n'));
    }
    return parts.join('\n\n');
  }

  pruneExpired(): number {
    const now = new Date().toISOString();
    const before = this.overlays.length;
    this.overlays = this.overlays.filter(o => !o.expiresAt || o.expiresAt >= now);
    return before - this.overlays.length;
  }

  clear(): void {
    this.overlays = [];
  }

  count(): number {
    return this.overlays.length;
  }
}
