import { readFileSync } from 'fs';
import { join } from 'path';

export interface BootstrapContext {
  bootstrapFiles: Array<{ name: string; content: string }>;
  agentId: string;
}

let omocContent: string | null = null;

function loadOmocContent(): string {
  if (omocContent) return omocContent;
  try {
    omocContent = readFileSync(join(process.cwd(), 'OMOC.md'), 'utf-8');
  } catch {
    try {
      omocContent = readFileSync(join(__dirname, '../../OMOC.md'), 'utf-8');
    } catch {
      omocContent = '# OmOC not found\nOMOC.md could not be loaded.';
    }
  }
  return omocContent;
}

export function contextInjectorHandler(context: BootstrapContext): void {
  context.bootstrapFiles.push({
    name: 'OMOC.md',
    content: loadOmocContent(),
  });
}
