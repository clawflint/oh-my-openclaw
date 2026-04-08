import { writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

export function atomicWriteSync(filePath: string, data: string): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = join(dir, `.tmp-${randomBytes(6).toString('hex')}`);
  writeFileSync(tmpPath, data, { flush: true });
  renameSync(tmpPath, filePath);
}
