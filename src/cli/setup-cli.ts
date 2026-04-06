#!/usr/bin/env bun
import { scaffoldProject } from './setup.js';

const result = scaffoldProject('.');

if (result.success) {
  console.log('✓', result.message);
  console.log('\nCreated:');
  for (const item of result.created) {
    console.log('  -', item);
  }
} else {
  console.error('✗ Setup failed:', result.message);
  process.exit(1);
}
