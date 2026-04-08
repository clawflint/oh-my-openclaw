import { describe, it, expect, afterEach } from 'vitest';
import { atomicWriteSync } from './atomic-write.js';
import { readFileSync, existsSync, rmSync } from 'fs';

const TEST_FILE = '/tmp/omoc-atomic-test.json';

afterEach(() => { if (existsSync(TEST_FILE)) rmSync(TEST_FILE); });

describe('atomicWriteSync', () => {
  it('writes file atomically', () => {
    atomicWriteSync(TEST_FILE, '{"hello":"world"}');
    expect(readFileSync(TEST_FILE, 'utf-8')).toBe('{"hello":"world"}');
  });
  it('overwrites existing file', () => {
    atomicWriteSync(TEST_FILE, 'first');
    atomicWriteSync(TEST_FILE, 'second');
    expect(readFileSync(TEST_FILE, 'utf-8')).toBe('second');
  });
  it('creates parent directories', () => {
    const deep = '/tmp/omoc-atomic-deep/sub/dir/file.json';
    atomicWriteSync(deep, 'data');
    expect(readFileSync(deep, 'utf-8')).toBe('data');
    rmSync('/tmp/omoc-atomic-deep', { recursive: true });
  });
  it('leaves no temp files on success', () => {
    atomicWriteSync(TEST_FILE, 'clean');
    const { readdirSync } = require('fs');
    const files = readdirSync('/tmp').filter((f: string) => f.startsWith('.tmp-'));
    expect(files.length).toBe(0);
  });
});
