#!/usr/bin/env bun
import { scaffoldProject } from './cli/setup.js';
import { runDoctorCli } from './cli/doctor.js';
import { runByomInstaller } from './install/byom.js';

function printHelp() {
  console.log(
    [
      'oh-my-openclaw CLI',
      '',
      'Usage:',
      '  oh-my-openclaw setup',
      '  oh-my-openclaw doctor',
      '  oh-my-openclaw install-byom --workspace=<id> --token=<token> [--api=<url>]',
    ].join('\n')
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'setup': {
      const result = scaffoldProject('.');
      if (result.success) {
        console.log('✓', result.message);
        for (const item of result.created) {
          console.log('  -', item);
        }
        process.exit(0);
      }
      console.error('✗ Setup failed:', result.message);
      process.exit(1);
      break;
    }

    case 'doctor': {
      process.exit(runDoctorCli());
      break;
    }

    case 'install-byom': {
      await runByomInstaller(args);
      process.exit(0);
      break;
    }

    default: {
      printHelp();
      process.exit(command ? 1 : 0);
      break;
    }
  }
}

main().catch((error) => {
  console.error('✗ CLI failed:', error);
  process.exit(1);
});
