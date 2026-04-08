import { describe, it, expect } from 'vitest';
import { formatConflictReport, suggestStrategy, type MergeConflict } from './conflict-resolver.js';

describe('formatConflictReport', () => {
  it('formats conflict with file list', () => {
    const conflict: MergeConflict = {
      branch: 'omoc/builder/task-1',
      targetBranch: 'main',
      conflictingFiles: ['src/index.ts', 'src/config.ts'],
      detectedAt: '2026-04-08T12:00:00Z',
    };
    const report = formatConflictReport(conflict);
    expect(report).toContain('Merge conflict');
    expect(report).toContain('src/index.ts');
    expect(report).toContain('src/config.ts');
    expect(report).toContain('/resolve ours');
    expect(report).toContain('/reattempt');
  });
});

describe('suggestStrategy', () => {
  it('suggests theirs for test-only conflicts', () => {
    expect(suggestStrategy(['src/foo.test.ts', 'src/bar.test.ts'])).toBe('theirs');
  });
  it('suggests ours for config-only conflicts', () => {
    expect(suggestStrategy(['config.json', 'tsconfig.json'])).toBe('ours');
  });
  it('suggests reattempt for small mixed conflicts', () => {
    expect(suggestStrategy(['src/index.ts', 'src/utils.ts'])).toBe('reattempt');
  });
  it('suggests manual for large mixed conflicts', () => {
    expect(suggestStrategy(['a.ts', 'b.ts', 'c.ts', 'd.ts'])).toBe('manual');
  });
});
