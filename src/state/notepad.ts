import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { atomicWriteSync } from './atomic-write.js';

export class Notepad {
  private path: string;

  constructor(path: string = '.omoc/notepad.md') {
    this.path = path;
  }

  read(): string {
    if (!existsSync(this.path)) return '';
    return readFileSync(this.path, 'utf-8');
  }

  write(content: string): void {
    mkdirSync(dirname(this.path), { recursive: true });
    atomicWriteSync(this.path, content);
  }

  append(entry: string): void {
    const existing = this.read();
    const timestamp = new Date().toISOString();
    const newContent = existing
      ? `${existing}\n\n---\n\n**${timestamp}**\n${entry}`
      : `# OmOC Notepad\n\n**${timestamp}**\n${entry}`;
    this.write(newContent);
  }

  clear(): void {
    this.write('# OmOC Notepad\n');
  }

  search(query: string): string[] {
    const content = this.read();
    if (!content) return [];
    const entries = content.split(/\n---\n/);
    return entries.filter(e => e.toLowerCase().includes(query.toLowerCase()));
  }
}
