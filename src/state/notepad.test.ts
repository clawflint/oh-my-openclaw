import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Notepad } from './notepad.js';
import { rmSync, existsSync } from 'fs';

const TEST_PATH = '/tmp/omoc-notepad-test/notepad.md';

describe('Notepad', () => {
  beforeEach(() => { if (existsSync('/tmp/omoc-notepad-test')) rmSync('/tmp/omoc-notepad-test', { recursive: true }); });
  afterEach(() => { if (existsSync('/tmp/omoc-notepad-test')) rmSync('/tmp/omoc-notepad-test', { recursive: true }); });

  it('returns empty string when file does not exist', () => {
    const n = new Notepad(TEST_PATH);
    expect(n.read()).toBe('');
  });
  it('writes and reads content', () => {
    const n = new Notepad(TEST_PATH);
    n.write('hello');
    expect(n.read()).toBe('hello');
  });
  it('appends entries with timestamps', () => {
    const n = new Notepad(TEST_PATH);
    n.append('First entry');
    n.append('Second entry');
    const content = n.read();
    expect(content).toContain('First entry');
    expect(content).toContain('Second entry');
    expect(content).toContain('---');
  });
  it('clears content', () => {
    const n = new Notepad(TEST_PATH);
    n.append('data');
    n.clear();
    expect(n.read()).toBe('# OmOC Notepad\n');
  });
  it('searches entries', () => {
    const n = new Notepad(TEST_PATH);
    n.append('Fixed the auth bug');
    n.append('Added new feature');
    n.append('Fixed the login flow');
    const results = n.search('fixed');
    expect(results.length).toBe(2);
  });
});
