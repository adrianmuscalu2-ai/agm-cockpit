import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const roots = [
  resolve(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  resolve(new URL('../../api/src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
];

for (const root of roots) {
  const graph = buildGraph(root);
  const cycles = findCycles(graph).map((cycle) =>
    cycle.map((file) => relative(root, file).replaceAll('\\', '/')),
  );
  const expected: string[][] = [];
  assert.deepEqual(
    cycles,
    expected,
    `Import-cycle baseline changed under ${root}:\n${cycles
      .map((cycle) => cycle.join(' -> '))
      .join('\n')}`,
  );
  console.log(
    `Import cycle baseline PASS: ${relative(process.cwd(), root)} (${graph.size} files, ${cycles.length} known)`,
  );
}

function buildGraph(root: string) {
  const sourceFiles = files(root);
  const graph = new Map<string, string[]>();
  for (const file of sourceFiles) {
    const content = readFileSync(file, 'utf8');
    const dependencies = [...content.matchAll(/(?:import|export)[\s\S]*?(?:from\s+)?['"](\.[^'"]+)['"]/g)]
      .map((match) => resolveImport(file, match[1]))
      .filter((candidate): candidate is string => Boolean(candidate) && candidate.startsWith(root));
    graph.set(file, [...new Set(dependencies)].sort());
  }
  return graph;
}

function resolveImport(importer: string, specifier: string) {
  const base = resolve(dirname(importer), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function findCycles(graph: Map<string, string[]>) {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const cycles = new Map<string, string[]>();

  const visit = (node: string) => {
    if (active.has(node)) {
      const start = stack.indexOf(node);
      const cycle = [...stack.slice(start), node];
      cycles.set(cycle.join(' -> '), cycle);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    stack.pop();
    active.delete(node);
  };

  for (const node of graph.keys()) visit(node);
  return [...cycles.values()].sort((left, right) => left.join().localeCompare(right.join()));
}

function files(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    })
    .filter((file) => ['.ts', '.tsx'].includes(extname(file)));
}
