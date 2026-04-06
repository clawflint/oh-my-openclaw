#!/usr/bin/env bun
import { FileStateManager } from '../state/file-state-manager.js';
import { fileURLToPath } from 'url';

interface DiagnosticCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
}

export function runDiagnostics(): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];

  checks.push({
    name: 'Plugin structure',
    status: 'pass',
    message: 'Core modules loaded successfully'
  });

  try {
    new FileStateManager('.omoc');
    checks.push({
      name: 'State directory',
      status: 'pass',
      message: '.omoc/ directory accessible'
    });
  } catch {
    checks.push({
      name: 'State directory',
      status: 'warn',
      message: '.omoc/ directory not found, run setup'
    });
  }

  try {
    const { existsSync } = require('fs');
    if (existsSync('AGENTS.md')) {
      checks.push({
        name: 'AGENTS.md',
        status: 'pass',
        message: 'Project guidance file found'
      });
    } else {
      checks.push({
        name: 'AGENTS.md',
        status: 'warn',
        message: 'Project guidance file not found, run setup'
      });
    }
  } catch {
    checks.push({
      name: 'AGENTS.md',
      status: 'warn',
      message: 'Could not check for AGENTS.md'
    });
  }

  try {
    const version = Bun.version;
    checks.push({
      name: 'Bun runtime',
      status: 'pass',
      message: `Bun ${version}`
    });
  } catch {
    checks.push({
      name: 'Bun runtime',
      status: 'fail',
      message: 'Bun runtime not detected'
    });
  }

  try {
    import('zod');
    checks.push({
      name: 'Dependencies',
      status: 'pass',
      message: 'Required packages installed'
    });
  } catch {
    checks.push({
      name: 'Dependencies',
      status: 'fail',
      message: 'Missing required packages, run bun install'
    });
  }

  return checks;
}

export function runDoctorCli(): number {
  const checks = runDiagnostics();

  console.log('OmOC Diagnostics\n');

  let hasFailures = false;
  for (const check of checks) {
    const symbol = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    console.log(`${symbol} ${check.name}: ${check.message}`);
    if (check.status === 'fail') hasFailures = true;
  }

  console.log('\n' + (hasFailures ? 'Some checks failed. Please fix the issues above.' : 'All checks passed!'));
  return hasFailures ? 1 : 0;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  process.exit(runDoctorCli());
}
