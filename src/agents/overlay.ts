import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { AgentsOverlay } from '../types/index.js';

export class AgentsMdLoader {
  private basePath: string;

  constructor(basePath: string = '.') {
    this.basePath = basePath;
  }

  loadProjectOverlay(): AgentsOverlay | null {
    const agentsMdPath = join(this.basePath, 'AGENTS.md');
    
    if (!existsSync(agentsMdPath)) {
      return null;
    }

    try {
      const content = readFileSync(agentsMdPath, 'utf-8');
      return this.parseAgentsMd(content);
    } catch {
      return null;
    }
  }

  loadSubdirectoryOverlay(directoryPath: string): AgentsOverlay | null {
    const agentsMdPath = join(directoryPath, 'AGENTS.md');
    
    if (!existsSync(agentsMdPath)) {
      return null;
    }

    try {
      const content = readFileSync(agentsMdPath, 'utf-8');
      return this.parseAgentsMd(content);
    } catch {
      return null;
    }
  }

  private parseAgentsMd(content: string): AgentsOverlay {
    const overlay: AgentsOverlay = {
      constraints: []
    };

    const sections = this.extractSections(content);

    if (sections['Execution Protocol']) {
      overlay.executionProtocol = sections['Execution Protocol'];
    }

    if (sections['Constraints']) {
      overlay.constraints = sections['Constraints']
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^\s*-\s*/, '').trim());
    }

    if (sections['Verification Requirements']) {
      overlay.verificationRequirements = sections['Verification Requirements'];
    }

    if (sections['Cancellation Protocol']) {
      overlay.cancellationProtocol = sections['Cancellation Protocol'];
    }

    if (sections['State Management']) {
      overlay.stateManagement = sections['State Management'];
    }

    if (sections['Technology Context']) {
      overlay.technologyContext = sections['Technology Context'];
    }

    return overlay;
  }

  private extractSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');
    
    let currentSection: string | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const sectionMatch = line.match(/^##\s+(.+)$/);
      
      if (sectionMatch) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        currentSection = sectionMatch[1];
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }
}

export function mergeAgentsOverlays(
  base: AgentsOverlay,
  override: AgentsOverlay
): AgentsOverlay {
  return {
    executionProtocol: override.executionProtocol ?? base.executionProtocol,
    constraints: [...base.constraints, ...override.constraints],
    verificationRequirements: override.verificationRequirements ?? base.verificationRequirements,
    cancellationProtocol: override.cancellationProtocol ?? base.cancellationProtocol,
    stateManagement: override.stateManagement ?? base.stateManagement,
    technologyContext: override.technologyContext ?? base.technologyContext
  };
}

export function injectAgentsOverlay(
  systemPrompt: string,
  overlay: AgentsOverlay
): string {
  const parts: string[] = [systemPrompt];

  if (overlay.executionProtocol) {
    parts.push(`\n## Project Execution Protocol\n${overlay.executionProtocol}`);
  }

  if (overlay.constraints.length > 0) {
    parts.push(`\n## Constraints\n${overlay.constraints.map(c => `- ${c}`).join('\n')}`);
  }

  if (overlay.verificationRequirements) {
    parts.push(`\n## Verification Requirements\n${overlay.verificationRequirements}`);
  }

  if (overlay.cancellationProtocol) {
    parts.push(`\n## Cancellation Protocol\n${overlay.cancellationProtocol}`);
  }

  if (overlay.technologyContext) {
    parts.push(`\n## Technology Context\n${overlay.technologyContext}`);
  }

  return parts.join('\n');
}
