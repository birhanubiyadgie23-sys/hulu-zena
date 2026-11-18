import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const roots = ['api', 'public', 'scripts'];
let files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (path.endsWith('.js')) files.push(path);
  }
}
for (const root of roots) await walk(root);
for (const file of files) {
  const source = await readFile(file, 'utf8');
  if (!source.trim()) throw new Error(`Empty file: ${file}`);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Syntax check failed: ${file}\n${result.stderr}`);
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (pkg.type !== 'module') throw new Error('Project must use ES modules');
const apiFiles = files.filter(file => file.startsWith('api/'));
if (apiFiles.length > 12) throw new Error(`Vercel function count may exceed the 12-function target: ${apiFiles.length}`);
console.log(`Project checks passed: ${files.length} JavaScript files syntax-checked; ${apiFiles.length} API/helper files (maximum target 12).`);
