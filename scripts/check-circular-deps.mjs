import fs from 'node:fs';
import path from 'node:path';

const ENGINE_DIR = path.resolve(process.cwd(), 'src', 'engine');

function walkTsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = walkTsFiles(ENGINE_DIR);
const graph = new Map();
const layerViolations = [];

for (const file of files) {
  const rel = path.relative(ENGINE_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const deps = [];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const spec = match[1];
    if (spec.includes('/components/')) {
      layerViolations.push(`${rel} -> ${spec}`);
    }
    if (!spec.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(file), spec);
    const candidate = fs.existsSync(`${resolved}.ts`)
      ? `${resolved}.ts`
      : fs.existsSync(path.join(resolved, 'index.ts'))
        ? path.join(resolved, 'index.ts')
        : null;
    if (candidate && candidate.startsWith(ENGINE_DIR)) {
      deps.push(path.relative(ENGINE_DIR, candidate).replace(/\\/g, '/'));
    }
  }
  graph.set(rel, deps);
}

const visited = new Set();
const stack = new Set();
const cycles = [];

function dfs(node, trail) {
  visited.add(node);
  stack.add(node);
  for (const next of graph.get(node) || []) {
    if (!visited.has(next)) {
      dfs(next, [...trail, next]);
    } else if (stack.has(next)) {
      const idx = trail.indexOf(next);
      cycles.push([...trail.slice(idx), next].join(' -> '));
    }
  }
  stack.delete(node);
}

for (const node of graph.keys()) {
  if (!visited.has(node)) dfs(node, [node]);
}

if (cycles.length > 0 || layerViolations.length > 0) {
  if (cycles.length > 0) {
    console.error('❌ Circular dependencies detected in src/engine:');
    for (const c of cycles) console.error(`  - ${c}`);
  }
  if (layerViolations.length > 0) {
    console.error('❌ Engine -> UI layer violations detected:');
    for (const v of layerViolations) console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log(`✅ Architecture check passed: 0 circular dependencies, 0 UI layer violations across ${files.length} engine files.`);
