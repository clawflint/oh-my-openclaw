import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { scaffoldProject } from './setup.js';

const TEST_DIR = '.omoc-test-scaffold';

describe('scaffoldProject', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      const rmrf = (dir: string) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            rmrf(fullPath);
          } else {
            unlinkSync(fullPath);
          }
        }
        rmdirSync(dir);
      };
      rmrf(TEST_DIR);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      const rmrf = (dir: string) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            rmrf(fullPath);
          } else {
            unlinkSync(fullPath);
          }
        }
        rmdirSync(dir);
      };
      rmrf(TEST_DIR);
    }
  });

  test('should create .omoc directory structure', () => {
    const result = scaffoldProject(TEST_DIR);
    
    expect(result.success).toBe(true);
    expect(existsSync(join(TEST_DIR, '.omoc'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.omoc', 'state'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.omoc', 'state', 'sessions'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.omoc', 'state', 'tasks'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.omoc', 'state', 'workers'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.omoc', 'plans'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.omoc', 'worktrees'))).toBe(true);
  });

  test('should create AGENTS.md', () => {
    const result = scaffoldProject(TEST_DIR);
    
    expect(result.success).toBe(true);
    expect(existsSync(join(TEST_DIR, 'AGENTS.md'))).toBe(true);
    
    const { readFileSync } = require('fs');
    const content = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('Execution Protocol');
    expect(content).toContain('Constraints');
    expect(content).toContain('Verification Requirements');
  });

  test('should create config.json', () => {
    const result = scaffoldProject(TEST_DIR);
    
    expect(result.success).toBe(true);
    expect(existsSync(join(TEST_DIR, '.omoc', 'config.json'))).toBe(true);
    
    const { readFileSync } = require('fs');
    const content = readFileSync(join(TEST_DIR, '.omoc', 'config.json'), 'utf-8');
    const config = JSON.parse(content);
    expect(config.project).toBeDefined();
    expect(config.workflows).toBeDefined();
    expect(config.concurrency).toBeDefined();
    expect(config.costControls).toBeDefined();
  });

  test('should create .gitignore', () => {
    const result = scaffoldProject(TEST_DIR);
    
    expect(result.success).toBe(true);
    expect(existsSync(join(TEST_DIR, '.gitignore'))).toBe(true);
    
    const { readFileSync } = require('fs');
    const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(content).toContain('.omoc/state/');
  });

  test('should report created files', () => {
    const result = scaffoldProject(TEST_DIR);
    
    expect(result.success).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
    expect(result.message).toContain('initialized');
  });

  test('should be idempotent', () => {
    const result1 = scaffoldProject(TEST_DIR);
    const result2 = scaffoldProject(TEST_DIR);
    
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result2.created.length).toBeLessThan(result1.created.length);
  });
});
