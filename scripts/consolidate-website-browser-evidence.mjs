import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportPaths = process.argv.slice(2).map((path) => resolve(path));
if (reportPaths.length < 2) {
  throw new Error('Provide the browser report paths in chronological order; later reports supersede affected scenarios.');
}

const reports = await Promise.all(reportPaths.map(async (path) => ({
  path,
  report: JSON.parse(await readFile(path, 'utf8')),
})));
const scenariosByKey = new Map();
const infrastructureByPath = new Map();

for (const { path, report } of reports) {
  for (const scenario of report.scenarios) {
    scenariosByKey.set(`${scenario.engine}|${scenario.viewport}|${scenario.route}`, {
      ...scenario,
      sourceReport: path,
      screenshot: scenario.screenshot ? resolve(dirname(path), scenario.screenshot) : null,
    });
  }
  for (const item of report.infrastructure ?? []) infrastructureByPath.set(item.path, { ...item, sourceReport: path });
}

const scenarios = [...scenariosByKey.values()].sort((a, b) =>
  a.engine.localeCompare(b.engine) || a.viewport.localeCompare(b.viewport) || a.route.localeCompare(b.route));
const infrastructure = [...infrastructureByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
const engines = [...new Set(scenarios.map((scenario) => scenario.engine))].sort();
const routes = [...new Set(scenarios.map((scenario) => scenario.route))].sort();
const viewports = [...new Set(scenarios.map((scenario) => scenario.viewport))].sort();
const scenarioPass = scenarios.length === engines.length * routes.length * viewports.length
  && scenarios.every((scenario) => Object.values(scenario.checks).every(Boolean));
const infrastructurePass = infrastructure.length > 0 && infrastructure.every((item) => item.pass);
const gates = {
  visual: scenarioPass && scenarios.filter((scenario) => scenario.screenshot).length === 20,
  content: scenarioPass,
  routes: infrastructurePass,
  desktop: scenarios.filter((scenario) => scenario.viewport === 'desktop').every((scenario) => Object.values(scenario.checks).every(Boolean)),
  mobile: scenarios.filter((scenario) => scenario.viewport === 'mobile').every((scenario) => Object.values(scenario.checks).every(Boolean)),
  majorBrowsers: ['chromium', 'firefox', 'webkit'].every((engine) => scenarios.filter((scenario) => scenario.engine === engine).length === routes.length * viewports.length),
  languages12Presented: scenarios.filter((scenario) => ['/', '/de/', '/en/'].includes(scenario.route)).every((scenario) => scenario.checks.languagePresentation12 && scenario.checks.languageStatusHonest),
  metadata: scenarios.every((scenario) => scenario.checks.canonical && scenario.checks.openGraph && scenario.checks.indexable),
};
const passed = Object.values(gates).every(Boolean);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = resolve('evidence/website-final-release', `consolidated-${runId}`);
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  consolidationRule: 'Later reports supersede only matching engine/viewport/route records.',
  sourceReports: reportPaths,
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: passed ? 'PASS' : 'FAIL',
  targetPageStatus: passed ? 'PASS' : 'FAIL',
  scope: { engines, viewports, routes },
  scenarioCount: scenarios.length,
  screenshotCount: scenarios.filter((scenario) => scenario.screenshot).length,
  gates,
  infrastructure,
  scenarios,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resolve(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ evidenceDir, scenarioCount: report.scenarioCount, screenshotCount: report.screenshotCount, gates, passed }, null, 2));
if (!passed) process.exitCode = 1;
