import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

export interface WorktreeInfo {
  workerId: string;
  path: string;
  branch: string;
  baseCommit: string;
  createdAt: string;
}

export class WorktreeManager {
  private basePath: string;
  private worktrees: Map<string, WorktreeInfo> = new Map();

  constructor(basePath: string = '.omoc/worktrees') {
    this.basePath = basePath;
  }

  async createWorktree(workerId: string, branch: string): Promise<WorktreeInfo> {
    const worktreePath = join(this.basePath, workerId);
    
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }

    const baseCommit = this.getCurrentCommit();
    
    try {
      execSync(`git worktree add -b ${branch} ${worktreePath}`, {
        stdio: 'pipe',
        cwd: process.cwd()
      });
    } catch {
      try {
        execSync(`git worktree add ${worktreePath} ${branch}`, {
          stdio: 'pipe',
          cwd: process.cwd()
        });
      } catch (error) {
        throw new Error(`Failed to create worktree: ${error}`);
      }
    }

    const info: WorktreeInfo = {
      workerId,
      path: worktreePath,
      branch,
      baseCommit,
      createdAt: new Date().toISOString()
    };

    this.worktrees.set(workerId, info);
    return info;
  }

  async removeWorktree(workerId: string): Promise<void> {
    const info = this.worktrees.get(workerId);
    if (!info) return;

    try {
      execSync(`git worktree remove ${info.path} --force`, {
        stdio: 'pipe',
        cwd: process.cwd()
      });
    } catch {}

    this.worktrees.delete(workerId);
  }

  async pruneWorktrees(): Promise<void> {
    try {
      execSync('git worktree prune', {
        stdio: 'pipe',
        cwd: process.cwd()
      });
    } catch {}
  }

  getWorktree(workerId: string): WorktreeInfo | undefined {
    return this.worktrees.get(workerId);
  }

  listWorktrees(): WorktreeInfo[] {
    return Array.from(this.worktrees.values());
  }

  async commitChanges(workerId: string, message: string): Promise<string> {
    const info = this.worktrees.get(workerId);
    if (!info) throw new Error(`Worktree ${workerId} not found`);

    try {
      execSync('git add -A', {
        stdio: 'pipe',
        cwd: info.path
      });

      execSync(`git commit -m "${message}"`, {
        stdio: 'pipe',
        cwd: info.path
      });

      const commitHash = execSync('git rev-parse HEAD', {
        encoding: 'utf-8',
        cwd: info.path
      }).trim();

      return commitHash;
    } catch (error) {
      throw new Error(`Failed to commit: ${error}`);
    }
  }

  async pushBranch(workerId: string, remote: string = 'origin'): Promise<void> {
    const info = this.worktrees.get(workerId);
    if (!info) throw new Error(`Worktree ${workerId} not found`);

    try {
      execSync(`git push ${remote} ${info.branch}`, {
        stdio: 'pipe',
        cwd: info.path
      });
    } catch (error) {
      throw new Error(`Failed to push: ${error}`);
    }
  }

  async mergeBranch(workerId: string, targetBranch: string = 'main'): Promise<void> {
    const info = this.worktrees.get(workerId);
    if (!info) throw new Error(`Worktree ${workerId} not found`);

    try {
      execSync(`git checkout ${targetBranch}`, {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      execSync(`git merge ${info.branch} --no-ff -m "Merge ${info.branch}"`, {
        stdio: 'pipe',
        cwd: process.cwd()
      });
    } catch (error) {
      throw new Error(`Failed to merge: ${error}`);
    }
  }

  private getCurrentCommit(): string {
    try {
      return execSync('git rev-parse HEAD', {
        encoding: 'utf-8',
        cwd: process.cwd()
      }).trim();
    } catch {
      return 'unknown';
    }
  }
}
