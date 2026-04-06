import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { FileStateManager } from '../state/file-state-manager.js';
import {
  LoopCommand,
  StatusCommand,
  CancelCommand,
  PauseCommand,
  ResumeCommand,
  CleanupCommand,
  OmocSetupCommand,
  OmocCommand,
  OmocDoctorCommand,
  OmocStatusCommand,
  RunCommand,
  PlanCommand,
  BuildCommand,
  ParallelCommand
} from './handlers.js';
import type { CommandContext } from '../types/index.js';

const TEST_DIR = '.omoc-test-commands';

describe('Commands', () => {
  let stateManager: FileStateManager;
  let context: CommandContext;

  beforeEach(() => {
    stateManager = new FileStateManager(TEST_DIR);
    context = {
      sessionId: 'test-session',
      userId: 'user-1',
      channelId: 'channel-1',
      args: []
    };
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

  describe('/loop command', () => {
    test('should create a new loop session', async () => {
      const cmd = new LoopCommand();
      context.args = ['fix', 'the', 'tests'];
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Started loop session');
      expect(result.data).toHaveProperty('sessionId');
      expect(result.data).toHaveProperty('taskId');
    });

    test('should fail without task description', async () => {
      const cmd = new LoopCommand();
      context.args = [];
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Usage');
    });
  });

  describe('/status command', () => {
    test('should show no active sessions', async () => {
      const cmd = new StatusCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('No active sessions');
    });

    test('should show active session details', async () => {
      const loopCmd = new LoopCommand();
      context.args = ['test task'];
      await loopCmd.execute(context, stateManager);
      
      const cmd = new StatusCommand();
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Session:');
      expect(result.message).toContain('loop');
    });
  });

  describe('/cancel command', () => {
    test('should fail when no active session', async () => {
      const cmd = new CancelCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('No active session');
    });

    test('should cancel active session', async () => {
      const loopCmd = new LoopCommand();
      context.args = ['test task'];
      await loopCmd.execute(context, stateManager);
      
      const cmd = new CancelCommand();
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cancelled session');
    });
  });

  describe('/pause command', () => {
    test('should fail when no active session', async () => {
      const cmd = new PauseCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('No active session');
    });

    test('should pause active session', async () => {
      const loopCmd = new LoopCommand();
      context.args = ['test task'];
      await loopCmd.execute(context, stateManager);
      
      const cmd = new PauseCommand();
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Paused session');
    });
  });

  describe('/resume command', () => {
    test('should fail when no paused session', async () => {
      const cmd = new ResumeCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('No paused session');
    });

    test('should resume paused session', async () => {
      const loopCmd = new LoopCommand();
      context.args = ['test task'];
      await loopCmd.execute(context, stateManager);
      
      const pauseCmd = new PauseCommand();
      await pauseCmd.execute(context, stateManager);
      
      const cmd = new ResumeCommand();
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Resumed session');
    });
  });

  describe('/cleanup command', () => {
    test('should cleanup archived sessions', async () => {
      const cmd = new CleanupCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('cleanedCount');
    });
  });

  describe('/omoc setup command', () => {
    test('should initialize project', async () => {
      const cmd = new OmocSetupCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized');
    });
  });

  describe('/omoc command', () => {
    test('should show command help', async () => {
      const cmd = new OmocCommand();

      const result = await cmd.execute(context, stateManager);

      expect(result.success).toBe(true);
      expect(result.message).toContain('OmOC Commands');
    });
  });

  describe('/omoc doctor command', () => {
    test('should run diagnostics', async () => {
      const cmd = new OmocDoctorCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Diagnostics');
      expect(result.data).toHaveProperty('checks');
    });
  });

  describe('/omoc status command', () => {
    test('should show OmOC status', async () => {
      const cmd = new OmocStatusCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('OmOC Status');
    });
  });

  describe('/run command', () => {
    test('should start run pipeline', async () => {
      const cmd = new RunCommand();
      context.args = ['implement', 'auth'];
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('/run');
    });

    test('should fail without description', async () => {
      const cmd = new RunCommand();
      context.args = [];
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(false);
    });
  });

  describe('/plan command', () => {
    test('should start planning', async () => {
      const cmd = new PlanCommand();
      context.args = ['design', 'api'];
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Plan created');
    });

    test('should fail without description', async () => {
      const cmd = new PlanCommand();
      context.args = [];
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(false);
    });
  });

  describe('/build command', () => {
    test('should execute build', async () => {
      const cmd = new BuildCommand();
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
    });
  });

  describe('/parallel command', () => {
    test('should start parallel execution', async () => {
      const cmd = new ParallelCommand();
      context.args = ['3', 'implement', 'endpoints'];
      
      const result = await cmd.execute(context, stateManager);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Workers: 3');
    });
  });
});
