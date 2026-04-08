import type { ConcurrencyConfig } from '../types/index.js';

export class ConcurrencyLimiter {
  private config: ConcurrencyConfig;
  private activeWorkers: Map<string, number> = new Map(); // provider → count
  private activeModels: Map<string, number> = new Map(); // model → count
  private totalActive: number = 0;

  constructor(config: ConcurrencyConfig) {
    this.config = config;
  }

  canSpawn(provider: string, model: string): { allowed: boolean; reason?: string } {
    if (this.totalActive >= this.config.maxParallelWorkers) {
      return { allowed: false, reason: `Max parallel workers reached (${this.config.maxParallelWorkers})` };
    }
    const providerCount = this.activeWorkers.get(provider) || 0;
    if (providerCount >= this.config.perProviderLimit) {
      return { allowed: false, reason: `Provider limit reached for ${provider} (${this.config.perProviderLimit})` };
    }
    const modelCount = this.activeModels.get(model) || 0;
    if (modelCount >= this.config.perModelLimit) {
      return { allowed: false, reason: `Model limit reached for ${model} (${this.config.perModelLimit})` };
    }
    return { allowed: true };
  }

  acquire(provider: string, model: string): boolean {
    const check = this.canSpawn(provider, model);
    if (!check.allowed) return false;
    this.activeWorkers.set(provider, (this.activeWorkers.get(provider) || 0) + 1);
    this.activeModels.set(model, (this.activeModels.get(model) || 0) + 1);
    this.totalActive++;
    return true;
  }

  release(provider: string, model: string): void {
    const pc = this.activeWorkers.get(provider) || 0;
    if (pc > 0) this.activeWorkers.set(provider, pc - 1);
    const mc = this.activeModels.get(model) || 0;
    if (mc > 0) this.activeModels.set(model, mc - 1);
    if (this.totalActive > 0) this.totalActive--;
  }

  getStatus(): { total: number; byProvider: Record<string, number>; byModel: Record<string, number> } {
    return {
      total: this.totalActive,
      byProvider: Object.fromEntries(this.activeWorkers),
      byModel: Object.fromEntries(this.activeModels),
    };
  }

  reset(): void {
    this.activeWorkers.clear();
    this.activeModels.clear();
    this.totalActive = 0;
  }
}
