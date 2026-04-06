import type { AgentRole } from '../types/index.js';
import { AGENT_REGISTRY } from '../agents/registry.js';

export type PermissionLayer = 'prompt' | 'plugin' | 'host';

export interface PermissionCheck {
  agent: AgentRole;
  tool: string;
  layer: PermissionLayer;
  allowed: boolean;
  reason?: string;
}

export class PermissionEnforcer {
  private checks: PermissionCheck[] = [];

  checkAllLayers(agent: AgentRole, tool: string): { allowed: boolean; checks: PermissionCheck[] } {
    this.checks = [];

    const promptCheck = this.checkPromptLayer(agent, tool);
    this.checks.push(promptCheck);

    if (!promptCheck.allowed) {
      return { allowed: false, checks: this.checks };
    }

    const pluginCheck = this.checkPluginLayer(agent, tool);
    this.checks.push(pluginCheck);

    if (!pluginCheck.allowed) {
      return { allowed: false, checks: this.checks };
    }

    const hostCheck = this.checkHostLayer(agent, tool);
    this.checks.push(hostCheck);

    return { allowed: hostCheck.allowed, checks: this.checks };
  }

  private checkPromptLayer(agent: AgentRole, tool: string): PermissionCheck {
    const config = AGENT_REGISTRY[agent];
    const hasExplicitAllow = config.allowedTools.includes(tool as never);
    const hasExplicitDeny = config.deniedTools.includes(tool as never);

    if (hasExplicitDeny) {
      return {
        agent,
        tool,
        layer: 'prompt',
        allowed: false,
        reason: 'Tool explicitly denied in agent configuration'
      };
    }

    if (!hasExplicitAllow) {
      return {
        agent,
        tool,
        layer: 'prompt',
        allowed: false,
        reason: 'Tool not in allowed list'
      };
    }

    return {
      agent,
      tool,
      layer: 'prompt',
      allowed: true
    };
  }

  private checkPluginLayer(agent: AgentRole, tool: string): PermissionCheck {
    const config = AGENT_REGISTRY[agent];
    
    if (config.deniedTools.includes(tool as never)) {
      return {
        agent,
        tool,
        layer: 'plugin',
        allowed: false,
        reason: 'Plugin enforcement: tool denied'
      };
    }

    if (config.allowedTools.includes(tool as never)) {
      return {
        agent,
        tool,
        layer: 'plugin',
        allowed: true
      };
    }

    return {
      agent,
      tool,
      layer: 'plugin',
      allowed: false,
      reason: 'Plugin enforcement: tool not allowed'
    };
  }

  private checkHostLayer(agent: AgentRole, tool: string): PermissionCheck {
    const dangerousTools = ['bash', 'git_merge'];
    const config = AGENT_REGISTRY[agent];

    if (dangerousTools.includes(tool) && config.layer !== 'orchestration') {
      return {
        agent,
        tool,
        layer: 'host',
        allowed: false,
        reason: 'Host enforcement: dangerous tool restricted to orchestration layer'
      };
    }

    return {
      agent,
      tool,
      layer: 'host',
      allowed: true
    };
  }

  validateBeforeExecution(agent: AgentRole, tool: string, args: unknown[]): { valid: boolean; error?: string } {
    const { allowed, checks } = this.checkAllLayers(agent, tool);

    if (!allowed) {
      const failedCheck = checks.find(c => !c.allowed);
      return {
        valid: false,
        error: `Permission denied at ${failedCheck?.layer} layer: ${failedCheck?.reason}`
      };
    }

    const destructiveCheck = this.checkDestructiveOperation(tool, args);
    if (destructiveCheck.isDestructive) {
      return {
        valid: false,
        error: `Destructive operation requires approval: ${destructiveCheck.reason}`
      };
    }

    return { valid: true };
  }

  private checkDestructiveOperation(tool: string, args: unknown[]): { isDestructive: boolean; reason?: string } {
    if (tool === 'bash' && args.length > 0) {
      const command = String(args[0]).toLowerCase();
      
      if (command.includes('rm -rf') || command.includes('rm -r /')) {
        return { isDestructive: true, reason: 'Recursive deletion' };
      }
      
      if (command.includes('git push --force') || command.includes('git push -f')) {
        return { isDestructive: true, reason: 'Force push' };
      }
      
      if (command.includes('drop table') || command.includes('delete from')) {
        return { isDestructive: true, reason: 'Database destructive operation' };
      }
    }

    if (tool === 'write') {
      const path = String(args[0] || '');
      if (path.includes('.github/workflows/') || path.includes('.gitlab-ci.')) {
        return { isDestructive: true, reason: 'CI/CD configuration modification' };
      }
    }

    return { isDestructive: false };
  }
}

export const permissionEnforcer = new PermissionEnforcer();
