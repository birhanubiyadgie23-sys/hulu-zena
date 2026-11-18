import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const check = spawnSync(process.execPath, ['scripts/check-project.js'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status || 1);
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
console.log('Static website assets copied to dist/.');
