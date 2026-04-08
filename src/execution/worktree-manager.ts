import { execSync } from 'child_process';
import { join } from 'path';

export interface WorktreeInfo {
  path: string;
  branch: string;
  agentRole: string;
  taskId: string;
  createdAt: string;
}

export function createWorktreeBranch(taskId: string, agentRole: string): string {
  return `omoc/${agentRole}/${taskId}`;
}

export function createWorktree(
  repoPath: string,
  taskId: string,
  agentRole: string,
  baseBranch: string = 'main'
): WorktreeInfo {
  const branch = createWorktreeBranch(taskId, agentRole);
  const worktreePath = join(repoPath, '.omoc', 'worktrees', `${agentRole}-${taskId}`);

  // Create branch from base
  try {
    execSync(`git -C "${repoPath}" branch "${branch}" "${baseBranch}" 2>/dev/null || true`, { stdio: 'pipe' });
  } catch { /* branch may already exist */ }

  // Create worktree
  execSync(`git -C "${repoPath}" worktree add "${worktreePath}" "${branch}" 2>/dev/null || true`, { stdio: 'pipe' });

  return {
    path: worktreePath,
    branch,
    agentRole,
    taskId,
    createdAt: new Date().toISOString(),
  };
}

export function removeWorktree(repoPath: string, worktreePath: string): void {
  try {
    execSync(`git -C "${repoPath}" worktree remove "${worktreePath}" --force 2>/dev/null || true`, { stdio: 'pipe' });
  } catch { /* best effort */ }
}

export function listWorktrees(repoPath: string): string[] {
  try {
    const output = execSync(`git -C "${repoPath}" worktree list --porcelain`, { encoding: 'utf-8', stdio: 'pipe' });
    return output
      .split('\n')
      .filter(line => line.startsWith('worktree '))
      .map(line => line.replace('worktree ', ''));
  } catch {
    return [];
  }
}

export function mergeWorktree(repoPath: string, branch: string, targetBranch: string = 'main'): boolean {
  try {
    execSync(`git -C "${repoPath}" checkout "${targetBranch}" && git -C "${repoPath}" merge "${branch}" --no-edit`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function cleanupOmocWorktrees(repoPath: string): number {
  const worktrees = listWorktrees(repoPath);
  let cleaned = 0;
  for (const wt of worktrees) {
    if (wt.includes('.omoc/worktrees/')) {
      removeWorktree(repoPath, wt);
      cleaned++;
    }
  }
  return cleaned;
}
