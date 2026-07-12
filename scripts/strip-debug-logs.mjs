import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipDirs = new Set(['node_modules', 'dist', '.git', 'build']);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!skipDirs.has(name)) walk(full, files);
    } else if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function stripConsoleLogs(source) {
  const lines = source.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^console\.(log|debug|info)\(/.test(trimmed)) {
      let depth = 0;
      let started = false;
      let buf = '';
      let j = i;
      for (; j < lines.length; j++) {
        const chunk = lines[j];
        for (const ch of chunk) {
          if (ch === '(') {
            depth++;
            started = true;
          } else if (ch === ')') {
            depth--;
          }
        }
        buf += (j > i ? '\n' : '') + chunk;
        if (started && depth === 0) break;
      }
      if (buf.trim().endsWith(';')) {
        i = j + 1;
        continue;
      }
    }

    out.push(line);
    i++;
  }

  return out.join('\n');
}

const files = walk(root);
let changed = 0;

for (const file of files) {
  if (file.includes('strip-debug-logs.mjs')) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = stripConsoleLogs(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
  }
}

console.log(`Stripped debug logs from ${changed} files`);
