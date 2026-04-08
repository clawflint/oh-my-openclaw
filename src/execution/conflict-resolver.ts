// src/execution/conflict-resolver.ts
import { execSync } from 'child_process';

export type ConflictStrategy = 'ours' | 'theirs' | 'manual' | 'reattempt';

export interface MergeConflict {
  branch: string;
  targetBranch: string;
  conflictingFiles: string[];
  detectedAt: string;
}

export interface ConflictResolution {
  strategy: ConflictStrategy;
  resolvedFiles: string[];
  unresolvedFiles: string[];
}

export function detectMergeConflicts(repoPath: string, branch: string, targetBranch: string = 'main'): MergeConflict | null {
  try {
    execSync(`git -C "${repoPath}" merge --no-commit --no-ff "${branch}" 2>&1`, { stdio: 'pipe' });
    // No conflict — abort the test merge
    execSync(`git -C "${repoPath}" merge --abort 2>/dev/null || true`, { stdio: 'pipe' });
    return null;
  } catch (err) {
    // Merge failed — likely conflicts
    try {
      const output = execSync(`git -C "${repoPath}" diff --name-only --diff-filter=U`, { encoding: 'utf-8', stdio: 'pipe' });
      const conflictingFiles = output.split('\n').filter(Boolean);
      execSync(`git -C "${repoPath}" merge --abort 2>/dev/null || true`, { stdio: 'pipe' });

      if (conflictingFiles.length === 0) return null;

      return {
        branch,
        targetBranch,
        conflictingFiles,
        detectedAt: new Date().toISOString(),
      };
    } catch {
      execSync(`git -C "${repoPath}" merge --abort 2>/dev/null || true`, { stdio: 'pipe' });
      return null;
    }
  }
}

export function resolveConflict(repoPath: string, file: string, strategy: 'ours' | 'theirs'): boolean {
  try {
    execSync(`git -C "${repoPath}" checkout --${strategy} "${file}" && git -C "${repoPath}" add "${file}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function formatConflictReport(conflict: MergeConflict): string {
  return [
    `⚠️ Merge conflict detected`,
    `Branch: ${conflict.branch} → ${conflict.targetBranch}`,
    `Conflicting files (${conflict.conflictingFiles.length}):`,
    ...conflict.conflictingFiles.map(f => `  - ${f}`),
    '',
    'Options:',
    '  /resolve ours — Keep target branch version',
    '  /resolve theirs — Keep source branch version',
    '  /reattempt — Re-run the builder on conflicting files',
  ].join('\n');
}

export function suggestStrategy(conflictingFiles: string[]): ConflictStrategy {
  // If only test files conflict, prefer theirs (new tests)
  const allTests = conflictingFiles.every(f => f.includes('.test.') || f.includes('__tests__'));
  if (allTests) return 'theirs';

  // If only config files, prefer ours (keep stable config)
  const allConfig = conflictingFiles.every(f => f.includes('config') || f.includes('.json') || f.includes('.yaml'));
  if (allConfig) return 'ours';

  // Otherwise, manual resolution or reattempt
  return conflictingFiles.length <= 3 ? 'reattempt' : 'manual';
}
